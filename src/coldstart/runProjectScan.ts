import { writeCaptureFile } from "../capture/writeCapture.js";
import { collectProjectScan } from "./collectProjectScan.js";
import { buildScanCaptures } from "./buildScanCaptures.js";

export interface RunProjectScanResult {
  capturesWritten: number;
  warnings: string[];
  skipped: boolean;
}

export function runProjectScan(repoRoot: string): RunProjectScanResult {
  const data = collectProjectScan(repoRoot);
  const formatted = buildScanCaptures(data);

  if (formatted.length === 0) {
    return {
      capturesWritten: 0,
      warnings: data.warnings,
      skipped: true,
    };
  }

  for (const cap of formatted) {
    writeCaptureFile(repoRoot, cap);
  }

  return {
    capturesWritten: formatted.length,
    warnings: data.warnings,
    skipped: false,
  };
}
