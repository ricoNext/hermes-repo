import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const CONFIG_REL = join(".memory", "config.json");

export function findRepoRoot(startDir?: string): string | null {
  let dir = resolve(startDir ?? process.cwd());

  while (true) {
    if (existsSync(join(dir, CONFIG_REL))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}
