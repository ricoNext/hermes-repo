import { existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { memoryPath } from "../init/paths.js";
import { ignoreMarkerPath } from "./ignoreMarker.js";

export function archiveCapturePath(
  repoRoot: string,
  captureRelativePath: string,
): string {
  return memoryPath(repoRoot, ".archive", captureRelativePath);
}

export function moveCaptureToArchive(
  repoRoot: string,
  captureRelativePath: string,
): boolean {
  const src = join(repoRoot, ".memory", captureRelativePath);
  if (!existsSync(src)) {
    return false;
  }
  const dest = archiveCapturePath(repoRoot, captureRelativePath);
  mkdirSync(dirname(dest), { recursive: true });
  renameSync(src, dest);

  const ignore = ignoreMarkerPath(repoRoot, captureRelativePath);
  if (existsSync(ignore)) {
    try {
      unlinkSync(ignore);
    } catch {
      // best effort
    }
  }
  const promote = join(repoRoot, ".memory", `${captureRelativePath}.promote`);
  if (existsSync(promote)) {
    try {
      unlinkSync(promote);
    } catch {
      // best effort
    }
  }
  return true;
}
