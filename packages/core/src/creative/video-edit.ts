import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { prisma } from "../db";
import { DomainError } from "../domain/errors";
import { envInt } from "../env";
import { MAX_VIDEO_SECONDS, downloadToFile, getOwnedUpload, saveEditedFile } from "./uploads";

/**
 * Video düzenleme (kes, kadrajla, hızlandır, sesi kapat) — sunucuda ffmpeg ile.
 * AI kullanılmaz, fal maliyeti yoktur; yalnız bizim işlem gücümüz harcanır. Bu yüzden:
 *  - kaynak en çok 60 sn ve 100 MB, çıktı en çok 720p,
 *  - kuyruk tek tek işlenir (aynı anda bir ffmpeg),
 *  - tenant başına günlük üst sınır vardır (VIDEO_EDITS_PER_DAY, varsayılan 30).
 */
export const videoOpsSchema = z.object({
  trimStart: z.number().min(0).max(3600).default(0),
  trimEnd: z.number().min(0).max(3600).nullable().default(null),
  aspect: z.enum(["orijinal", "9:16", "1:1", "4:5", "16:9"]).default("orijinal"),
  speed: z.union([z.literal(0.5), z.literal(1), z.literal(1.5), z.literal(2)]).default(1),
  mute: z.boolean().default(false),
});
export type VideoOps = z.infer<typeof videoOpsSchema>;

const ASPECT: Record<Exclude<VideoOps["aspect"], "orijinal">, number> = { "9:16": 9 / 16, "1:1": 1, "4:5": 4 / 5, "16:9": 16 / 9 };

/** ffmpeg argümanları (saf; test edilebilir). Çıktı: H.264/AAC MP4, ≤720p, web için faststart. */
export function buildFfmpegArgs(input: string, output: string, ops: VideoOps, sourceDuration: number | null): string[] {
  const start = Math.max(0, ops.trimStart);
  const endRaw = ops.trimEnd ?? sourceDuration ?? start + MAX_VIDEO_SECONDS;
  const end = Math.min(endRaw, start + MAX_VIDEO_SECONDS);
  if (end <= start) throw new DomainError("DOGRULAMA", "Bitiş zamanı başlangıçtan sonra olmalı.");
  const filters: string[] = [];
  if (ops.aspect !== "orijinal") {
    const a = ASPECT[ops.aspect].toFixed(6);
    // Ortadan kırp: geniş kaynakta yükseklik korunur, dar kaynakta genişlik.
    filters.push(`crop='if(gt(iw/ih,${a}),ih*${a},iw)':'if(gt(iw/ih,${a}),ih,iw/${a})'`);
  }
  // En çok 720p; boyutlar çift sayı olmalı (H.264).
  filters.push("scale='trunc(min(iw,if(gt(ih,iw),720,1280))/2)*2':-2");
  if (ops.speed !== 1) filters.push(`setpts=PTS/${ops.speed}`);
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-ss", String(start), "-to", String(end), "-i", input, "-vf", filters.join(",")];
  if (ops.mute) args.push("-an");
  else {
    if (ops.speed !== 1) args.push("-af", `atempo=${ops.speed}`);
    args.push("-c:a", "aac", "-b:a", "128k");
  }
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output);
  return args;
}

function run(cmd: string, args: string[], timeoutMs: number): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args);
    let out = "";
    let err = "";
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => {
      clearTimeout(t);
      resolve({ code: -1, out, err: String(e.message) });
    });
    p.on("close", (code) => {
      clearTimeout(t);
      resolve({ code: code ?? -1, out, err });
    });
  });
}

async function probeDuration(file: string): Promise<number | null> {
  const r = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file], 30_000);
  const n = Number(r.out.trim());
  return r.code === 0 && Number.isFinite(n) ? n : null;
}

/** Düzenleme isteğini kuyruğa alır (sahiplik, tür ve günlük sınır kontrolü). */
export async function enqueueVideoEdit(input: { tenantId: string; uploadId: string; ops: unknown }) {
  const upload = await getOwnedUpload(input.tenantId, input.uploadId);
  if (upload.kind !== "video") throw new DomainError("DOGRULAMA", "Bu dosya bir video değil.");
  const parsed = videoOpsSchema.safeParse(input.ops);
  if (!parsed.success) throw new DomainError("DOGRULAMA", "Geçersiz düzenleme ayarı (hız 0,5/1/1,5/2; süreler saniye).");
  const ops = parsed.data;
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const today = await prisma.videoEditJob.count({ where: { tenantId: input.tenantId, createdAt: { gte: since } } });
  if (today >= envInt("VIDEO_EDITS_PER_DAY", 30)) throw new DomainError("KURAL_IHLALI", "Günlük video düzenleme sınırına ulaştınız; yarın tekrar deneyin.");
  const job = await prisma.videoEditJob.create({ data: { tenantId: input.tenantId, uploadId: upload.id, ops } });
  void processVideoQueue();
  return job;
}

let running = false;
/**
 * Kuyruğu sırayla işler (süreç içinde, aynı anda tek ffmpeg). Takılı kalmış işler
 * (sunucu yeniden başlatıldıysa) 15 dk sonra başarısız sayılır.
 */
export async function processVideoQueue(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await prisma.videoEditJob.updateMany({ where: { status: "RUNNING", updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } }, data: { status: "FAILED", error: "İşlem yarıda kaldı, tekrar deneyin." } });
    for (;;) {
      const next = await prisma.videoEditJob.findFirst({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" } });
      if (!next) break;
      const claim = await prisma.videoEditJob.updateMany({ where: { id: next.id, status: "QUEUED" }, data: { status: "RUNNING" } });
      if (claim.count !== 1) continue;
      try {
        const outId = await runVideoJob(next.tenantId, next.uploadId, videoOpsSchema.parse(next.ops));
        await prisma.videoEditJob.update({ where: { id: next.id }, data: { status: "DONE", outputUploadId: outId } });
      } catch (e) {
        const msg = e instanceof DomainError ? e.message : "Video işlenemedi. Dosya bozuk veya desteklenmeyen bir kodek olabilir.";
        await prisma.videoEditJob.update({ where: { id: next.id }, data: { status: "FAILED", error: msg } });
      }
    }
  } finally {
    running = false;
  }
}

async function runVideoJob(tenantId: string, uploadId: string, ops: VideoOps): Promise<string> {
  const upload = await getOwnedUpload(tenantId, uploadId);
  const dir = mkdtempSync(path.join(tmpdir(), "vedit-"));
  try {
    const src = path.join(dir, `src${path.extname(upload.s3Key) || ".mp4"}`);
    const out = path.join(dir, "out.mp4");
    await downloadToFile(upload.s3Key, src);
    const duration = await probeDuration(src);
    if (duration == null) throw new DomainError("DOGRULAMA", "Video okunamadı.");
    const r = await run("ffmpeg", buildFfmpegArgs(src, out, ops, duration), 5 * 60 * 1000);
    if (r.code !== 0) throw new Error(r.err.slice(0, 500));
    const outDuration = await probeDuration(out);
    const saved = await saveEditedFile({ tenantId, parentId: upload.id, body: readFileSync(out), mime: "video/mp4", name: upload.name ? `${upload.name} (düzenlendi)` : "Düzenlenmiş video", durationSec: outDuration });
    return saved.id;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
