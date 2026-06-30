import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GITKEEP_DIRS, MEMORY_DIR, MEMORY_SUBDIRS } from "./paths.js";

export function ensureMemoryTree(repoRoot: string): void {
  const memoryRoot = join(repoRoot, MEMORY_DIR);
  mkdirSync(memoryRoot, { recursive: true });

  for (const sub of MEMORY_SUBDIRS) {
    mkdirSync(join(memoryRoot, sub), { recursive: true });
  }

  mkdirSync(join(repoRoot, ".claude"), { recursive: true });

  for (const sub of GITKEEP_DIRS) {
    const keepPath = join(memoryRoot, sub, ".gitkeep");
    writeFileSync(keepPath, "", { flag: "a" });
  }
}
