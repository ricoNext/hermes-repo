import { existsSync } from "node:fs";
import { join } from "node:path";

export function ignoreMarkerPath(repoRoot: string, capturePath: string): string {
  return join(repoRoot, ".memory", `${capturePath}.ignore`);
}

export function hasIgnoreMarker(repoRoot: string, capturePath: string): boolean {
  return existsSync(ignoreMarkerPath(repoRoot, capturePath));
}
