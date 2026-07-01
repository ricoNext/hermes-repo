import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectBinding } from "./types.js";
import { readConfigAtRepo } from "./readConfig.js";

function readLegacyProjectBinding(repoRoot: string): ProjectBinding | null {
  const projectPath = join(repoRoot, ".memory", "project.json");
  if (!existsSync(projectPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(readFileSync(projectPath, "utf8")) as Record<
      string,
      unknown
    >;
    const projectId =
      typeof raw.projectId === "string" ? raw.projectId.trim() : "";
    if (!projectId) {
      return null;
    }

    return { projectId };
  } catch {
    return null;
  }
}

export function readProjectBindingAtRepo(
  repoRoot: string,
): ProjectBinding | null {
  const mcp = readConfigAtRepo(repoRoot)?.storage.mcp;
  const projectId = mcp?.projectId?.trim() ?? "";
  if (projectId) {
    return { projectId };
  }

  return readLegacyProjectBinding(repoRoot);
}
