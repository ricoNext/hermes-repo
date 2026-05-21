import { existsSync } from "node:fs";
import { join } from "node:path";
import { debugLog } from "../config/debugLog.js";
import type { ParsedCapture } from "../consolidate/parseCapture.js";

export function promoteMarkerPath(
  repoRoot: string,
  capturePath: string,
): string {
  return join(repoRoot, ".memory", `${capturePath}.promote`);
}

export function hasPromoteMarker(
  repoRoot: string,
  capturePath: string,
): boolean {
  return existsSync(promoteMarkerPath(repoRoot, capturePath));
}

export function attachPromoteMarkers(
  repoRoot: string,
  captures: ParsedCapture[],
  debug?: boolean,
): void {
  for (const c of captures) {
    c.hasPromoteMarker = hasPromoteMarker(repoRoot, c.path);
    if (c.hasPromoteMarker && c.type !== "procedural") {
      debugLog(
        debug === true,
        "skills",
        `warn: .promote on non-procedural ${c.path}, skipped for skill promotion`,
      );
    }
  }
}
