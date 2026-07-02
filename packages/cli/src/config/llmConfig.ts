import type { LlmConfigV2 } from "./types.js";

export type LlmConfig = LlmConfigV2;

export const DEFAULT_LLM_TIMEOUT_MS = 60_000;
export const DEFAULT_LLM_MAX_INPUT_CHARS = 24_000;
export const DEFAULT_LLM_BASE_URL = "https://api.deepseek.com";
export const DEFAULT_LLM_MODEL = "deepseek-v4-flash";

export function defaultDisabledLlmConfig(): LlmConfig {
  return {
    enabled: false,
    provider: "openai",
    baseUrl: DEFAULT_LLM_BASE_URL,
    model: DEFAULT_LLM_MODEL,
    apiKey: "",
    timeoutMs: DEFAULT_LLM_TIMEOUT_MS,
    maxInputChars: DEFAULT_LLM_MAX_INPUT_CHARS,
  };
}

export function isLlmAvailable(cfg: LlmConfig | null): boolean {
  if (!cfg?.enabled) {
    return false;
  }
  return (
    Boolean(cfg.apiKey?.trim()) &&
    Boolean(cfg.baseUrl?.trim()) &&
    Boolean(cfg.model?.trim())
  );
}

export function parseLlmConfigRaw(raw: Record<string, unknown>): LlmConfig | null {
  if (raw.enabled !== true && raw.enabled !== false) {
    return null;
  }
  const baseUrl = typeof raw.baseUrl === "string" ? raw.baseUrl : "";
  const model = typeof raw.model === "string" ? raw.model : "";
  const apiKey = typeof raw.apiKey === "string" ? raw.apiKey : "";
  const timeoutMs =
    typeof raw.timeoutMs === "number" && raw.timeoutMs > 0
      ? raw.timeoutMs
      : DEFAULT_LLM_TIMEOUT_MS;
  const maxInputChars =
    typeof raw.maxInputChars === "number" && raw.maxInputChars > 0
      ? raw.maxInputChars
      : DEFAULT_LLM_MAX_INPUT_CHARS;
  const provider =
    typeof raw.provider === "string" ? raw.provider : "openai";

  return {
    enabled: raw.enabled,
    provider,
    baseUrl,
    model,
    apiKey,
    timeoutMs,
    maxInputChars,
  };
}
