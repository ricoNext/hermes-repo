import { spawnSync } from "node:child_process";
import type { GitLogScan } from "./types.js";

export function collectGitLog(repoRoot: string, limit = 50): GitLogScan {
  const result = spawnSync(
    "git",
    ["log", `--oneline`, `-${limit}`],
    { cwd: repoRoot, encoding: "utf8" },
  );
  if (result.status !== 0 || !result.stdout?.trim()) {
    return { lines: [] };
  }
  return {
    lines: result.stdout
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  };
}
