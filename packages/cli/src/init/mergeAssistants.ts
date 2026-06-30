import { existsSync, readFileSync } from "node:fs";
import type { AssistantId } from "./assistants/types.js";
import { memoryPath } from "./paths.js";

function readExistingAssistants(repoRoot: string): AssistantId[] {
  const configPath = memoryPath(repoRoot, "config.json");
  if (!existsSync(configPath)) {
    return [];
  }
  try {
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      assistants?: unknown;
    };
    if (!Array.isArray(config.assistants)) {
      return [];
    }
    return config.assistants.filter((id): id is AssistantId => typeof id === "string");
  } catch {
    return [];
  }
}

/** 与已有 config.assistants 做并集（保留已有 id + 追加本次选择） */
export function mergeAssistants(
  repoRoot: string,
  selected: AssistantId[],
): AssistantId[] {
  const existing = readExistingAssistants(repoRoot);
  return [...new Set([...existing, ...selected])];
}
