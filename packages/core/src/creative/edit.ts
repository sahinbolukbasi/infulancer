import { DomainError } from "../domain/errors";
import { submitCreative } from "./fal";
import { getOwnedUpload, presignCreativeGet } from "./uploads";

/**
 * Yüklenen görsel üzerinde AI düzenlemesi (ücretli, TL bakiyeden düşer).
 * Ücretsiz düzenlemeler (kırp, döndür, filtre, yazı) tarayıcıda yapılır; buraya gelmez.
 *
 *  - prompt-duzenle  → nano-banana-edit (komutla düzenle)        15 TL
 *  - arka-plan-kaldir → bria-bg-remove                            8 TL
 *  - netlestir       → esrgan-upscale (2x)                         5 TL
 *  - videoya-cevir   → kling-v2-5-i2v (5 veya 10 sn)             300 TL/sn
 *
 * Kaynak dosya modele 1 saatlik imzalı URL ile verilir; bucket herkese açılmaz.
 */
export const EDIT_ACTIONS = {
  "prompt-duzenle": { modelKey: "nano-banana-edit", generative: true, needsPrompt: true },
  "arka-plan-kaldir": { modelKey: "bria-bg-remove", generative: false, needsPrompt: false },
  netlestir: { modelKey: "esrgan-upscale", generative: false, needsPrompt: false },
  "videoya-cevir": { modelKey: "kling-v2-5-i2v", generative: true, needsPrompt: true },
} as const;
export type EditAction = keyof typeof EDIT_ACTIONS;

const LABEL: Record<EditAction, string> = {
  "prompt-duzenle": "Komutla düzenleme",
  "arka-plan-kaldir": "Arka plan kaldırma",
  netlestir: "Netleştirme (2x)",
  "videoya-cevir": "Görselden video",
};

export async function submitImageEdit(input: { tenantId: string; uploadId: string; action: string; prompt?: string | null; seconds?: number; portrait?: boolean }) {
  const def = EDIT_ACTIONS[input.action as EditAction];
  if (!def) throw new DomainError("DOGRULAMA", "Geçersiz düzenleme türü.");
  const action = input.action as EditAction;
  const upload = await getOwnedUpload(input.tenantId, input.uploadId);
  if (upload.kind !== "image") throw new DomainError("DOGRULAMA", "AI düzenleme için bir görsel seçin.");
  const userPrompt = (input.prompt ?? "").trim();
  if (def.needsPrompt && userPrompt.length < 5) throw new DomainError("DOGRULAMA", "Ne değişsin? En az 5 karakterlik bir komut yazın.");
  const url = await presignCreativeGet(upload.s3Key);

  let falInput: Record<string, unknown>;
  let units = 1;
  if (action === "prompt-duzenle") falInput = { prompt: userPrompt, image_urls: [url], num_images: 1, output_format: "png" };
  else if (action === "arka-plan-kaldir") falInput = { image_url: url }; // prompt gönderilmez (fal'da daha pahalı)
  else if (action === "netlestir") falInput = { image_url: url, scale: 2, output_format: "png" };
  else {
    units = input.seconds === 10 ? 10 : 5; // Kling yalnız 5 veya 10 sn
    falInput = { prompt: userPrompt, image_url: url, duration: String(units) };
  }

  return submitCreative({
    tenantId: input.tenantId,
    modelKey: def.modelKey,
    // Kayıt/denetim için okunur istem; kural motoru (md. 27/12) bunu da tarar.
    prompt: def.needsPrompt ? userPrompt : `${LABEL[action]} — ${upload.name ?? "yüklenen görsel"}`,
    units,
    // Gerçek kişi koruması yalnız üretken düzenlemelerde: arka plan kaldırma/netleştirme kimlik üretmez.
    referenceImageIsPortrait: def.generative ? !!input.portrait : false,
    falInput,
    inputUploadId: upload.id,
  });
}
