import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { envStr } from "../env";

/**
 * C2PA Content Credentials: export anında her üretilen varlığa manifest gömülür (Meta "AI Info" ve
 * TikTok AIGC etiketi C2PA ile otomatik tetiklenir; EU AI Act md. 50 makine-okunabilir işaret ister).
 * C2PA_MODE=c2patool ise c2patool CLI ile imzalanır; aksi halde mock: manifest JSON sidecar olarak
 * üretilir ve manifest kimliği kaydedilir. Metadata SIYIRAN hiçbir özellik sunulmaz.
 */
export type C2paInput = { assetBytes: Uint8Array; mime: string; modelKey: string; modelId: string; tenantId: string; promptHash: string; parentAssetId?: string | null };
export type C2paOutput = { manifestId: string; manifest: Record<string, unknown>; signedBytes: Uint8Array; sidecarJson: string };

export function buildManifest(i: C2paInput, manifestId: string) {
  return {
    claim_generator: "infulancer/1.0",
    instance_id: `xmp:iid:${manifestId}`,
    title: `generated-${manifestId}`,
    format: i.mime,
    assertions: [
      { label: "c2pa.actions.v2", data: { actions: [{ action: "c2pa.created", digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia", softwareAgent: i.modelId }] } },
      { label: "infulancer.provenance", data: { model_key: i.modelKey, model_id: i.modelId, prompt_hash: i.promptHash, parent_asset_id: i.parentAssetId ?? null } },
    ],
    asset_sha256: createHash("sha256").update(i.assetBytes).digest("hex"),
  };
}

export function embedC2pa(i: C2paInput): C2paOutput {
  const manifestId = randomUUID();
  const manifest = buildManifest(i, manifestId);
  if (envStr("C2PA_MODE", "mock") === "c2patool") {
    const r = spawnSync("c2patool", ["-", "--manifest", "-", "--output", "-"], { input: Buffer.from(i.assetBytes) });
    if (r.status !== 0) throw new Error(`c2patool hatası: ${r.stderr?.toString().slice(0, 200)}`);
    return { manifestId, manifest, signedBytes: new Uint8Array(r.stdout), sidecarJson: JSON.stringify(manifest) };
  }
  return { manifestId, manifest, signedBytes: i.assetBytes, sidecarJson: JSON.stringify(manifest) };
}

/** Müşteriye gösterilen AI açıklama kontrol listesi. */
export const aiDisclosureChecklist = [
  "Bu varlık AI ile üretilmiştir (C2PA Content Credentials gömülü).",
  "Meta: reklam/gönderi oluştururken 'AI ile oluşturuldu' açıklamasını kontrol edin (C2PA'lı yüklemelerde 'AI Info' otomatik uygulanır).",
  "TikTok: gerçekçi insan/yer/olay tasviri varsa AIGC etiketini açın; branded content ise ticari içerik açıklamasını da açın.",
  "md. 23/A: 'Reklam'/'Tanıtım' + reklam veren adı ilk unsur olarak yer almalı.",
  "Sanal/AI persona kullanılıyorsa AI açıklaması ayrıca yapılmalı.",
];
