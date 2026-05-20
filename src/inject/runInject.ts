import { existsSync, readFileSync } from "node:fs";
import { debugFromContext } from "../config/debugLog.js";
import { loadRepoContext } from "../config/readConfig.js";
import { memoryPath } from "../init/paths.js";
import { INJECT_MAX_CHARS } from "./constants.js";

export function runInject(cwd?: string): { injected: boolean; chars: number } {
  const ctx = loadRepoContext(cwd);
  if (!ctx) {
    return { injected: false, chars: 0 };
  }

  const memoryFile = memoryPathOnDisk(ctx.repoRoot);
  if (!existsSync(memoryFile)) {
    debugFromContext(ctx, "inject", "skip: MEMORY.md missing");
    return { injected: false, chars: 0 };
  }

  const contentRaw = readFileSync(memoryFile, "utf8");
  if (!contentRaw.trim()) {
    debugFromContext(ctx, "inject", "skip: MEMORY.md empty");
    return { injected: false, chars: 0 };
  }

  let content = contentRaw;
  if (content.length > INJECT_MAX_CHARS) {
    content = `${content.slice(0, INJECT_MAX_CHARS)}\n\n...(truncated)`;
  }

  process.stdout.write(content);
  if (!content.endsWith("\n")) {
    process.stdout.write("\n");
  }

  debugFromContext(ctx, "inject", `ok: injected ${content.length} chars`);

  return { injected: true, chars: content.length };
}

function memoryPathOnDisk(repoRoot: string): string {
  return memoryPath(repoRoot, "MEMORY.md");
}
