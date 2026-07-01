import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { RepoContext } from "./types.js";
import { memoryPath } from "../init/paths.js";

export const DEBUG_LOG_DIR = "logs";
export const DEBUG_LOG_FILES = {
  capture: "capture.log",
  flush: "flush.log",
  consolidate: "consolidate.log",
} as const;

let logDirPath: string | null = null;

export function configureDebugLogging(
  repoRoot: string | null,
  enabled: boolean,
): void {
  if (!enabled || !repoRoot) {
    logDirPath = null;
    return;
  }
  logDirPath = memoryPath(repoRoot, DEBUG_LOG_DIR);
}

function formatLine(phase: string, message: string): string {
  return `${new Date().toISOString()} hermes-repo [${phase}] ${message}`;
}

function writeToLogFile(phase: string, line: string): void {
  if (!logDirPath) {
    return;
  }
  mkdirSync(logDirPath, { recursive: true });
  appendFileSync(join(logDirPath, logFileNameForPhase(phase)), `${line}\n`, "utf8");
}

function logFileNameForPhase(phase: string): string {
  switch (phase) {
    case "capture":
      return DEBUG_LOG_FILES.capture;
    case "flush":
      return DEBUG_LOG_FILES.flush;
    case "consolidate":
    case "llm":
      return DEBUG_LOG_FILES.consolidate;
    default:
      return `${phase.replace(/[^a-z0-9_-]/gi, "-") || "debug"}.log`;
  }
}

export function debugLog(
  enabled: boolean,
  phase: string,
  message: string,
): void {
  if (!enabled) {
    return;
  }
  const line = formatLine(phase, message);
  console.error(line);
  writeToLogFile(phase, line);
}

export function debugLogBlock(
  enabled: boolean,
  phase: string,
  label: string,
  content: string,
): void {
  if (!enabled) {
    return;
  }

  debugLog(true, phase, `${label} BEGIN`);
  for (const line of content.split(/\r?\n/)) {
    debugLog(true, phase, `| ${line}`);
  }
  debugLog(true, phase, `${label} END`);
}

export function debugFromContext(
  ctx: RepoContext | null | undefined,
  phase: string,
  message: string,
): void {
  debugLog(ctx?.config.debug === true, phase, message);
}
