import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { SkillUsageMap } from "./types.js";
import { skillUsagePath } from "./paths.js";

export function readSkillUsage(repoRoot: string): SkillUsageMap {
  const path = skillUsagePath(repoRoot);
  if (!existsSync(path)) {
    return {};
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as SkillUsageMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeSkillUsage(repoRoot: string, map: SkillUsageMap): void {
  writeFileSync(
    skillUsagePath(repoRoot),
    `${JSON.stringify(map, null, 2)}\n`,
    "utf8",
  );
}

export function mergeSkillUsage(
  existing: SkillUsageMap,
  target: string,
  addCount: number,
  lastUsed: string,
): SkillUsageMap {
  const prev = existing[target];
  const prevCount = prev?.use_count ?? 0;
  const prevDate = prev?.last_used ?? "";
  return {
    ...existing,
    [target]: {
      use_count: prevCount + addCount,
      last_used: lastUsed > prevDate ? lastUsed : prevDate || lastUsed,
    },
  };
}
