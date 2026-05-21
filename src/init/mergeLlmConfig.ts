import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_MAX_INPUT_CHARS,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_TIMEOUT_MS,
  type LlmConfig,
} from "../config/llmConfig.js";
import { readLlmConfigAtRepo, serializeLlmConfig } from "../config/readLlmConfig.js";
import type { InitFileAction } from "./types.js";
import { memoryPath } from "./paths.js";

export interface LlmInitInput {
  enabled: boolean;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  provider?: string;
}

export function mergeLlmConfigForInit(
  repoRoot: string,
  input: LlmInitInput,
): { content: string; action: InitFileAction } {
  const llmPath = memoryPath(repoRoot, "llm.json");
  const existed = existsSync(llmPath);

  let existing: Partial<LlmConfig> = {};
  if (existed) {
    try {
      const parsed = readLlmConfigAtRepo(repoRoot);
      if (parsed) {
        existing = parsed;
      }
    } catch {
      existing = {};
    }
  }

  const merged: LlmConfig = {
    enabled: input.enabled,
    provider:
      input.provider ??
      (typeof existing.provider === "string" ? existing.provider : "openai"),
    baseUrl:
      input.baseUrl ??
      (typeof existing.baseUrl === "string" && existing.baseUrl
        ? existing.baseUrl
        : DEFAULT_LLM_BASE_URL),
    model:
      input.model ??
      (typeof existing.model === "string" && existing.model
        ? existing.model
        : DEFAULT_LLM_MODEL),
    apiKey:
      input.apiKey !== undefined && input.apiKey !== ""
        ? input.apiKey
        : typeof existing.apiKey === "string"
          ? existing.apiKey
          : "",
    timeoutMs:
      typeof existing.timeoutMs === "number"
        ? existing.timeoutMs
        : DEFAULT_LLM_TIMEOUT_MS,
    maxInputChars:
      typeof existing.maxInputChars === "number"
        ? existing.maxInputChars
        : DEFAULT_LLM_MAX_INPUT_CHARS,
    mode: existing.mode === "sync" ? "sync" : "async",
  };

  return {
    content: serializeLlmConfig(merged),
    action: existed ? "overwritten" : "created",
  };
}

export function writeLlmJson(
  repoRoot: string,
  input: LlmInitInput,
): InitFileAction {
  const { content, action } = mergeLlmConfigForInit(repoRoot, input);
  writeFileSync(memoryPath(repoRoot, "llm.json"), content, "utf8");
  return action;
}
