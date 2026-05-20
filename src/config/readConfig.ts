import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssistantId } from "../init/assistants/types.js";
import { findRepoRoot } from "./findRepoRoot.js";
import type { HermesConfig, RepoContext } from "./types.js";

function isAssistantId(value: unknown): value is AssistantId {
  return typeof value === "string";
}

export function readConfigAtRepo(repoRoot: string): HermesConfig | null {
  const configPath = join(repoRoot, ".memory", "config.json");
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf8")) as {
      version?: number;
      storage?: { backend?: string };
      assistants?: unknown;
      debug?: unknown;
    };
    if (raw.version !== 1 || raw.storage?.backend !== "file") {
      return null;
    }
    const assistants = Array.isArray(raw.assistants)
      ? raw.assistants.filter(isAssistantId)
      : [];
    return {
      version: 1,
      storage: { backend: "file" },
      assistants,
      debug: raw.debug === true,
    };
  } catch {
    return null;
  }
}

export function loadRepoContext(cwd?: string): RepoContext | null {
  const repoRoot = findRepoRoot(cwd);
  if (!repoRoot) {
    return null;
  }
  const config = readConfigAtRepo(repoRoot);
  if (!config) {
    return null;
  }
  return { repoRoot, config };
}
