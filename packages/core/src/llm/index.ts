import { envStr } from "../env";
import { bedrockProvider } from "./bedrock";
import { mockProvider } from "./mock";
import type { LlmProvider } from "./types";

export type { LlmProvider } from "./types";
export { prompts } from "./prompts";

/** LLM_PROVIDER=bedrock ise Bedrock, aksi halde deterministik mock. */
export function getLlm(): LlmProvider {
  return envStr("LLM_PROVIDER", "mock") === "bedrock" ? bedrockProvider : mockProvider;
}
