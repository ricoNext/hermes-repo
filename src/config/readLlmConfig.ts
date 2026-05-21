import { existsSync, readFileSync } from "node:fs";
import { memoryPath } from "../init/paths.js";
import {
  defaultDisabledLlmConfig,
  parseLlmConfigRaw,
  type LlmConfig,
} from "./llmConfig.js";

export function readLlmConfigAtRepo(repoRoot: string): LlmConfig | null {
  const llmPath = memoryPath(repoRoot, "llm.json");
  if (!existsSync(llmPath)) {
    return null;
  }
  try {
    const raw = JSON.parse(readFileSync(llmPath, "utf8")) as Record<
      string,
      unknown
    >;
    return parseLlmConfigRaw(raw);
  } catch {
    return null;
  }
}

/** Missing file → disabled-shaped config for init defaults */
export function readLlmConfigOrDefault(repoRoot: string): LlmConfig {
  return readLlmConfigAtRepo(repoRoot) ?? defaultDisabledLlmConfig();
}

export function serializeLlmConfig(cfg: LlmConfig): string {
  return `${JSON.stringify(cfg, null, 2)}\n`;
}
