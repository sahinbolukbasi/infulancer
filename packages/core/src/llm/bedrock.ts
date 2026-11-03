import { BedrockRuntimeClient, ConverseCommand, type ImageFormat } from "@aws-sdk/client-bedrock-runtime";
import { envStr, requireEnv } from "../env";
import { prompts } from "./prompts";
import type { LlmProvider, TextRequest, VisionRequest } from "./types";

let client: BedrockRuntimeClient | undefined;
function bedrock(): BedrockRuntimeClient {
  // Kimlik bilgisi SDK zincirinden (profil, ortam, IAM rolü) çözülür.
  client ??= new BedrockRuntimeClient({ region: envStr("BEDROCK_REGION", "eu-central-1") });
  return client;
}

function textOf(output: unknown): string {
  const content = (output as { message?: { content?: { text?: string }[] } })?.message?.content ?? [];
  return content.map((c) => c.text ?? "").join("").trim();
}

/** Model yanıtındaki ilk JSON nesnesini savunmacı biçimde ayrıştırır. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function imageFormat(mime: string): ImageFormat {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpeg";
}

export const bedrockProvider: LlmProvider = {
  name: "bedrock",
  async completeText(req: TextRequest) {
    const modelId = requireEnv("BEDROCK_TEXT_MODEL_ID");
    const res = await bedrock().send(
      new ConverseCommand({
        modelId,
        system: req.system ? [{ text: req.system }] : undefined,
        messages: [{ role: "user", content: [{ text: req.prompt }] }],
        inferenceConfig: { maxTokens: 800, temperature: 0.2 },
      }),
    );
    return { text: textOf(res.output), model: modelId };
  },
  async readScreenshotNumbers(req: VisionRequest) {
    const modelId = requireEnv("BEDROCK_VISION_MODEL_ID");
    const fields = Object.keys(req.expectedFields);
    const res = await bedrock().send(
      new ConverseCommand({
        modelId,
        system: [{ text: prompts.metrikOkuma.system }],
        messages: [
          {
            role: "user",
            content: [
              { image: { format: imageFormat(req.mime), source: { bytes: req.imageBytes } } },
              { text: `Okunacak alanlar: ${fields.join(", ")}. Yalnız JSON döndür.` },
            ],
          },
        ],
        inferenceConfig: { maxTokens: 400, temperature: 0 },
      }),
    );
    const parsed = parseJsonObject(textOf(res.output)) ?? {};
    const values: Record<string, number | null> = {};
    for (const f of fields) {
      const raw = parsed[f];
      const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw.replace(/[^\d.]/g, "")) : NaN;
      values[f] = Number.isFinite(n) ? n : null;
    }
    return { values, model: modelId };
  },
};
