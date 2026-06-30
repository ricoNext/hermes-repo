import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { debugLog } from "../config/debugLog.js";
import { memoryPath } from "../init/paths.js";
import type { AssistantId } from "../init/assistants/types.js";

export interface LlmJobPayload {
  jobId: string;
  sessionId: string;
  jsonlPath: string;
  captureFile: string;
  assistant: AssistantId;
  enqueuedAt: string;
}

function pendingDir(repoRoot: string): string {
  return memoryPath(repoRoot, "captures", "pending");
}

function cliPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "cli.js");
}

function makeJobId(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  return `${Date.now()}-${safe || "session"}`;
}

function removeStaleJobsForSession(
  repoRoot: string,
  sessionId: string,
): void {
  const dir = pendingDir(repoRoot);
  if (!existsSync(dir)) {
    return;
  }
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) {
      continue;
    }
    try {
      const raw = JSON.parse(
        readFileSync(join(dir, name), "utf8"),
      ) as LlmJobPayload;
      if (raw.sessionId === sessionId) {
        rmSync(join(dir, name), { force: true });
      }
    } catch {
      // skip
    }
  }
}

export function enqueueLlmJob(opts: {
  repoRoot: string;
  sessionId: string;
  jsonlPath: string;
  captureFile: string;
  assistant: AssistantId;
  debug?: boolean;
}): boolean {
  const { repoRoot, sessionId, jsonlPath, captureFile, assistant, debug } =
    opts;
  const dir = pendingDir(repoRoot);
  mkdirSync(dir, { recursive: true });
  removeStaleJobsForSession(repoRoot, sessionId);

  const jobId = makeJobId(sessionId);
  const payload: LlmJobPayload = {
    jobId,
    sessionId,
    jsonlPath,
    captureFile,
    assistant,
    enqueuedAt: new Date().toISOString(),
  };
  writeFileSync(
    join(dir, `${jobId}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );

  const child = spawn(
    process.execPath,
    [cliPath(), "capture-llm", "--job", jobId, "-C", repoRoot],
    {
      detached: true,
      stdio: "ignore",
      cwd: repoRoot,
    },
  );
  child.unref();

  debugLog(debug === true, "capture", `llm job enqueued: ${jobId}`);
  return true;
}

export function readLlmJob(
  repoRoot: string,
  jobId: string,
): LlmJobPayload | null {
  const path = join(pendingDir(repoRoot), `${jobId}.json`);
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as LlmJobPayload;
  } catch {
    return null;
  }
}

export function deleteLlmJob(repoRoot: string, jobId: string): void {
  const path = join(pendingDir(repoRoot), `${jobId}.json`);
  if (existsSync(path)) {
    rmSync(path, { force: true });
  }
}

export function listPendingJobs(repoRoot: string): LlmJobPayload[] {
  const dir = pendingDir(repoRoot);
  if (!existsSync(dir)) {
    return [];
  }
  const jobs: LlmJobPayload[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) {
      continue;
    }
    try {
      jobs.push(
        JSON.parse(readFileSync(join(dir, name), "utf8")) as LlmJobPayload,
      );
    } catch {
      // skip
    }
  }
  return jobs;
}
