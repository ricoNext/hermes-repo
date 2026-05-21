import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { RepoSignalsScan } from "./types.js";

const SIGNAL_FILES = [
  "Dockerfile",
  "Makefile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "prisma/schema.prisma",
  ".github/workflows",
] as const;

export function collectRepoSignals(repoRoot: string): RepoSignalsScan {
  const signals: string[] = [];
  for (const rel of SIGNAL_FILES) {
    const full = join(repoRoot, rel);
    if (existsSync(full)) {
      signals.push(rel);
    }
  }
  if (existsSync(join(repoRoot, ".gitignore"))) {
    signals.push(".gitignore");
  }
  try {
    const root = readdirSync(repoRoot);
    if (root.some((n) => n.startsWith("docker-compose"))) {
      signals.push("docker-compose (root)");
    }
  } catch {
    // ignore
  }
  return { signals: [...new Set(signals)] };
}
