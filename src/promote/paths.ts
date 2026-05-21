import { join } from "node:path";
import { memoryPath } from "../init/paths.js";

export function promoteDir(repoRoot: string): string {
  return memoryPath(repoRoot, "promote");
}

export function promoteStagingTopicsDir(repoRoot: string): string {
  return memoryPath(repoRoot, "promote", "staging", "topics");
}

export function defaultPrBodyPath(repoRoot: string, dateIso: string): string {
  return memoryPath(repoRoot, "promote", `pr-${dateIso}.md`);
}

export function decisionsTemplatePath(repoRoot: string): string {
  return memoryPath(repoRoot, "promote", "decisions.template.json");
}

export function resolvePromoteTemplatePath(repoRoot: string): string {
  const inMemory = memoryPath(repoRoot, "templates", "PROMOTE_PR.md");
  return inMemory;
}

export function stagingTopicPath(
  repoRoot: string,
  slug: string,
): string {
  return join(promoteStagingTopicsDir(repoRoot), `${slug}.md`);
}
