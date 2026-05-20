import { existsSync, writeFileSync } from "node:fs";
import type { InitFileAction, InitReport } from "./types.js";

export function shouldWriteFile(
  absolutePath: string,
  force: boolean,
): { write: boolean; action: InitFileAction } {
  if (!existsSync(absolutePath)) {
    return { write: true, action: "created" };
  }
  if (force) {
    return { write: true, action: "overwritten" };
  }
  return { write: false, action: "skipped" };
}

export function writeIfAllowed(
  report: InitReport,
  absolutePath: string,
  relativePath: string,
  content: string,
  force: boolean,
): void {
  const { write, action } = shouldWriteFile(absolutePath, force);
  if (!write) {
    report.files.push({ path: relativePath, action });
    return;
  }
  writeFileSync(absolutePath, content, "utf8");
  report.files.push({ path: relativePath, action });
}
