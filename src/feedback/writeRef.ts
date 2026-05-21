import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RefRecord } from "./types.js";
import {
  normalizeCaptureTarget,
  normalizeSkillTarget,
  refFilePath,
  refsDir,
} from "./paths.js";

export interface WriteRefOptions {
  repoRoot: string;
  capture?: string;
  skill?: string;
  reason: string;
  session?: string;
  date?: string;
}

function targetExists(repoRoot: string, target: string): boolean {
  return existsSync(join(repoRoot, ".memory", target));
}

export function writeRef(opts: WriteRefOptions): { target: string; file: string } {
  const { repoRoot, reason, session } = opts;
  const date = opts.date ?? new Date().toISOString().slice(0, 10);

  let target: string;
  if (opts.capture) {
    target = normalizeCaptureTarget(opts.capture);
  } else if (opts.skill) {
    target = normalizeSkillTarget(opts.skill);
  } else {
    throw new Error("specify --capture or --skill");
  }

  if (!targetExists(repoRoot, target)) {
    throw new Error(`target not found: .memory/${target}`);
  }

  const record: RefRecord = {
    target,
    reason,
    date,
    ...(session ? { session } : {}),
  };

  mkdirSync(refsDir(repoRoot), { recursive: true });
  const filePath = refFilePath(repoRoot, target, date);
  const base = filePath.replace(/\.json$/, "");
  let finalPath = `${filePath}`;
  let n = 0;
  while (existsSync(finalPath)) {
    n++;
    finalPath = `${base}-${n}.json`;
  }
  writeFileSync(finalPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");

  const file = finalPath.split("/refs/").pop() ?? finalPath;
  return { target, file: `refs/${file}` };
}
