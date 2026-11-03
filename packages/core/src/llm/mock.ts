import type { LlmProvider, TextRequest, VisionRequest } from "./types";

export const MOCK_MODEL = "mock-v1";

/**
 * Deterministik sağlayıcı: aynı girdi her zaman aynı çıktıyı verir. AWS kimlik
 * bilgisi olmadan yerel geliştirme ve testler için.
 */
export const mockProvider: LlmProvider = {
  name: "mock",
  async completeText(req: TextRequest) {
    const firstLine = req.prompt.split("\n").find((l) => l.trim()) ?? "";
    const text = `[Otomatik değerlendirme · ${req.promptVersion}] ${firstLine.slice(0, 280)}`;
    return { text, model: MOCK_MODEL };
  },
  async readScreenshotNumbers(req: VisionRequest) {
    const mismatch = (req.fileName ?? "").toLocaleLowerCase("tr").includes("uyumsuz");
    const values: Record<string, number | null> = {};
    for (const [field, value] of Object.entries(req.expectedFields)) {
      values[field] = mismatch ? Math.round(value * 1.3) : value;
    }
    return { values, model: MOCK_MODEL };
  },
};
