import { z } from "zod";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../db";
import { DomainError } from "../domain/errors";
import { envStr } from "../env";
import { chargeIn, creativePricing } from "./pricing";
import { tenantCurrency } from "./tenant";
import { formatMajor } from "../i18n/regions";
import { submitCreative } from "./fal";
import { getOwnedUpload, importGeneratedAsset, presignCreativeGet } from "./uploads";
/**
 * Yüklenen görsel üzerinde AI düzenlemesi (ücretli, işlemi yapanın bakiyesinden düşer).
 * Ücretsiz düzenlemeler (kırp, döndür, filtre, yazı) tarayıcıda yapılır; buraya gelmez.
 *
 *  - prompt-duzenle  → nano-banana-edit (komutla düzenle)
 *  - arka-plan-kaldir → bria-bg-remove
 *  - netlestir       → esrgan-upscale (2x)
 *  - videoya-cevir   → kling-v2-5-i2v (5/10 sn, yüksek kalite)
 *  - videoya-cevir-ekonomik → hailuo-02-fast-i2v (6/10 sn, 512p)
 *
 * Birden çok düzenleme seçilebilir: adımlar sabit sırayla zincirlenir (komut → arka plan → netleştir →
 * video); her adımın çıktısı bir sonrakinin girdisi olur. Her adım kendi tutarını kendi blokesiyle
 * öder; bir adım başarısız olursa o adımın ve sonraki adımların ücreti alınmaz.
 * Kaynak dosya modele 1 saatlik imzalı URL ile verilir; bucket herkese açılmaz.
 */
export const EDIT_ACTIONS = {
  "prompt-duzenle": { modelKey: "nano-banana-edit", generative: true, needsPrompt: true, order: 1 },
  "arka-plan-kaldir": { modelKey: "bria-bg-remove", generative: false, needsPrompt: false, order: 2 },
  netlestir: { modelKey: "esrgan-upscale", generative: false, needsPrompt: false, order: 3 },
  "videoya-cevir": { modelKey: "kling-v2-5-i2v", generative: true, needsPrompt: true, order: 4 },
  "videoya-cevir-ekonomik": { modelKey: "hailuo-02-fast-i2v", generative: true, needsPrompt: true, order: 4 },
} as const;
export type EditAction = keyof typeof EDIT_ACTIONS;
export const EDIT_LABEL: Record<EditAction, string> = {
  "prompt-duzenle": "Komutla düzenleme",
  "arka-plan-kaldir": "Arka plan kaldırma",
  netlestir: "Netleştirme (2x)",
  "videoya-cevir": "Görselden video",
  "videoya-cevir-ekonomik": "Görselden video (ekonomik)",
};
const isVideoAction = (a: EditAction) => a === "videoya-cevir" || a === "videoya-cevir-ekonomik";

export type EditStep = { action: EditAction; prompt: string | null; seconds?: number; portrait?: boolean };
const stepSchema = z.object({
  action: z.enum(Object.keys(EDIT_ACTIONS) as [EditAction, ...EditAction[]]),
  prompt: z.string().max(2000).nullable(),
  seconds: z.number().int().optional(),
  portrait: z.boolean().optional(),
});

/** Seçilen düzenlemeleri doğrular ve uygulanacak sıraya dizer (en çok bir video adımı, en sonda). */
export function orderSteps(steps: EditStep[]): EditStep[] {
  const seen = new Set<EditAction>();
  const out: EditStep[] = [];
  for (const s of steps) {
    if (!EDIT_ACTIONS[s.action]) throw new DomainError("DOGRULAMA", "Geçersiz düzenleme türü.");
    if (seen.has(s.action)) continue;
    seen.add(s.action);
    out.push(s);
  }
  if (out.length === 0) throw new DomainError("DOGRULAMA", "En az bir düzenleme seçin.");
  if (out.filter((s) => isVideoAction(s.action)).length > 1) throw new DomainError("DOGRULAMA", "Yalnız bir video dönüşümü seçebilirsiniz.");
  return out.sort((a, b) => EDIT_ACTIONS[a.action].order - EDIT_ACTIONS[b.action].order);
}

function stepUnits(s: EditStep): number {
  if (s.action === "videoya-cevir") return s.seconds === 10 ? 10 : 5; // Kling yalnız 5 veya 10 sn
  if (s.action === "videoya-cevir-ekonomik") return s.seconds === 10 ? 10 : 6; // Hailuo-02 Fast 6/10 sn
  return 1;
}

/** Zincirin toplam tutarı (TL): kullanıcıya baştan gösterilir ve bakiye baştan kontrol edilir. */
export async function pipelineCost(steps: EditStep[], currency = "TRY"): Promise<number> {
  const pricing = await creativePricing();
  let total = 0;
  for (const s of steps) {
    const m = await prisma.modelRegistry.findUnique({ where: { key: EDIT_ACTIONS[s.action].modelKey }, select: { creditsPerUnit: true } });
    if (!m) throw new DomainError("KURAL_IHLALI", `${EDIT_LABEL[s.action]} şu an kullanılamıyor.`);
    total += chargeIn(Number(m.creditsPerUnit), stepUnits(s), pricing, currency);
  }
  return total;
}

async function submitStep(tenantId: string, uploadId: string, step: EditStep, rest: EditStep[], parentJobId: string | null) {
  const def = EDIT_ACTIONS[step.action];
  const upload = await getOwnedUpload(tenantId, uploadId);
  if (upload.kind !== "image") throw new DomainError("DOGRULAMA", "AI düzenleme için bir görsel seçin.");
  const userPrompt = (step.prompt ?? "").trim();
  if (def.needsPrompt && userPrompt.length < 5) throw new DomainError("DOGRULAMA", `${EDIT_LABEL[step.action]}: ne değişsin? En az 5 karakterlik bir komut yazın.`);
  const url = await presignCreativeGet(upload.s3Key);
  const units = stepUnits(step);
  let falInput: Record<string, unknown>;
  if (step.action === "prompt-duzenle") falInput = { prompt: userPrompt, image_urls: [url], num_images: 1, output_format: "png" };
  else if (step.action === "arka-plan-kaldir") falInput = { image_url: url }; // prompt gönderilmez (fal'da daha pahalı)
  else if (step.action === "netlestir") falInput = { image_url: url, scale: 2, output_format: "png" };
  else if (step.action === "videoya-cevir") falInput = { prompt: userPrompt, image_url: url, duration: String(units) };
  else falInput = { prompt: userPrompt, image_url: url, duration: String(units), prompt_optimizer: true };
  const job = await submitCreative({
    tenantId,
    modelKey: def.modelKey,
    // Kayıt/denetim için okunur istem; kural motoru (md. 27/12) bunu da tarar.
    prompt: def.needsPrompt ? userPrompt : `${EDIT_LABEL[step.action]} — ${upload.name ?? "yüklenen görsel"}`,
    units,
    // Gerçek kişi koruması yalnız üretken düzenlemelerde: arka plan kaldırma/netleştirme kimlik üretmez.
    referenceImageIsPortrait: def.generative ? !!step.portrait : false,
    falInput,
    inputUploadId: upload.id,
  });
  if (rest.length || parentJobId) {
    await prisma.creativeJob.update({ where: { id: job.id }, data: { pipeline: rest.length ? rest : undefined, parentJobId } });
  }
  return job;
}

/** Tek düzenleme (geriye dönük uyumluluk). */
export async function submitImageEdit(input: { tenantId: string; uploadId: string; action: string; prompt?: string | null; seconds?: number; portrait?: boolean }) {
  return submitEditPipeline({ tenantId: input.tenantId, uploadId: input.uploadId, steps: [{ action: input.action as EditAction, prompt: input.prompt ?? null, seconds: input.seconds, portrait: input.portrait }] });
}

/**
 * Çok adımlı düzenleme: adımları sıralar, toplam tutar için bakiyeyi baştan kontrol eder ve ilk adımı
 * gönderir. Sonraki adımlar her adımın çıktısı geldikçe (fal webhook) otomatik başlar.
 */
export async function submitEditPipeline(input: { tenantId: string; uploadId: string; steps: EditStep[] }) {
  const parsed = z.array(stepSchema).max(5).safeParse(input.steps);
  if (!parsed.success) throw new DomainError("DOGRULAMA", "Geçersiz düzenleme seçimi.");
  const steps = orderSteps(parsed.data as EditStep[]);
  const upload = await getOwnedUpload(input.tenantId, input.uploadId);
  if (upload.kind !== "image") throw new DomainError("DOGRULAMA", "AI düzenleme için bir görsel seçin.");
  for (const s of steps) if (EDIT_ACTIONS[s.action].needsPrompt && (s.prompt ?? "").trim().length < 5) throw new DomainError("DOGRULAMA", `${EDIT_LABEL[s.action]}: en az 5 karakterlik bir komut yazın.`);
  const currency = await tenantCurrency(input.tenantId);
  const total = Math.round((await pipelineCost(steps, currency)) * 100) / 100;
  const acc = await prisma.creditAccount.findUnique({ where: { tenantId: input.tenantId } });
  const available = acc ? Number(acc.balanceCredits) - Number(acc.heldCredits) : 0;
  if (available < total) throw new DomainError("KURAL_IHLALI", `Bu düzenlemelerin toplamı ${formatMajor(total, currency)}; kullanılabilir bakiyeniz ${formatMajor(available, currency)}.`);
  return submitStep(input.tenantId, upload.id, steps[0]!, steps.slice(1), null);
}

/**
 * fal'dan başarılı çıktı geldiğinde çağrılır: zincirde kalan adım varsa çıktıyı kitaplığa alır ve
 * sonraki adımı başlatır. Hata olursa zincir durur (alınmamış adımlar için ücret yok).
 */
export async function continuePipeline(jobId: string, assetId: string): Promise<string | null> {
  const job = await prisma.creativeJob.findUnique({ where: { id: jobId } });
  const rest = job?.pipeline ? z.array(stepSchema).safeParse(job.pipeline) : null;
  if (!job || !rest?.success || rest.data.length === 0) return null;
  try {
    const upload = await importGeneratedAsset(job.tenantId, assetId);
    const [next, ...after] = rest.data as EditStep[];
    const nj = await submitStep(job.tenantId, upload.id, next!, after, job.parentJobId ?? job.id);
    if (envStr("FAL_MODE", "mock") === "mock" && nj.requestId) {
      const { handleFalWebhook } = await import("./fal");
      const video = isVideoAction(next!.action);
      await handleFalWebhook({ request_id: nj.requestId, status: "OK", payload: video ? { video: { url: "https://example.invalid/mock.mp4" } } : { image: { url: "https://example.invalid/mock.png" } } });
    }
    return nj.id;
  } catch (e) {
    await prisma.creativeJob.update({ where: { id: job.id }, data: { pipeline: Prisma.DbNull, rejectReason: `Sonraki adım başlatılamadı: ${(e as Error).message}`.slice(0, 300) } });
    return null;
  }
}

/** Zincirin tüm işleri (ilk iş kimliğinden), ilerleme ekranı için. */
export async function pipelineJobs(rootJobId: string) {
  return prisma.creativeJob.findMany({ where: { OR: [{ id: rootJobId }, { parentJobId: rootJobId }] }, orderBy: { createdAt: "asc" } });
}
