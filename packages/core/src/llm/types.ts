/** LLM sağlayıcı arayüzü. Bedrock Converse veya deterministik mock. */
export type TextRequest = { system: string; prompt: string; promptVersion: string };
export type TextResult = { text: string; model: string };

export type VisionRequest = {
  imageBytes: Uint8Array;
  mime: string;
  /** Ekran görüntüsünden okunması beklenen alanlar ve girilen değerler. */
  expectedFields: Record<string, number>;
  /** Mock modda dosya adı davranışı belirler ('uyumsuz' → değerler ×1.3). */
  fileName?: string;
  promptVersion: string;
};
export type VisionResult = { values: Record<string, number | null>; model: string };

export interface LlmProvider {
  readonly name: "bedrock" | "mock";
  completeText(req: TextRequest): Promise<TextResult>;
  readScreenshotNumbers(req: VisionRequest): Promise<VisionResult>;
}
