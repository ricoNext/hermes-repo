import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { debugLog } from "../config/debugLog.js";
import { isLlmAvailable } from "../config/llmConfig.js";
import { readLlmConfigAtRepo } from "../config/readLlmConfig.js";
import { parseJsonlFile } from "./claude-code/parseJsonl.js";
import {
  deleteLlmJob,
  listPendingJobs,
  readLlmJob,
  type LlmJobPayload,
} from "./enqueueLlmJob.js";
import { llmFormat } from "./formatCapture.js";
import { renderCaptureMarkdown } from "./writeCapture.js";

function captureAlreadyUpgraded(repoRoot: string, captureFile: string): boolean {
  const path = join(repoRoot, captureFile);
  if (!existsSync(path)) {
    return false;
  }
  const text = readFileSync(path, "utf8");
  return /llmUpgradedAt:/.test(text);
}

export async function runLlmJob(
  repoRoot: string,
  job: LlmJobPayload,
  debug?: boolean,
): Promise<{ ok: boolean; reason?: string }> {
  if (captureAlreadyUpgraded(repoRoot, job.captureFile)) {
    deleteLlmJob(repoRoot, job.jobId);
    return { ok: true, reason: "already-upgraded" };
  }

  const llm = readLlmConfigAtRepo(repoRoot);
  if (!isLlmAvailable(llm)) {
    return { ok: false, reason: "llm not available" };
  }

  if (!existsSync(job.jsonlPath)) {
    return { ok: false, reason: "jsonl missing" };
  }

  const session = parseJsonlFile(job.jsonlPath);
  const upgraded = await llmFormat(session, job.assistant, llm!);
  if (!upgraded) {
    debugLog(debug === true, "capture-llm", `llm job failed: ${job.jobId}`);
    return { ok: false, reason: "llm format failed" };
  }

  const target = join(repoRoot, job.captureFile);
  const temp = `${target}.hermes-tmp`;
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(temp, renderCaptureMarkdown(upgraded, date), "utf8");
  renameSync(temp, target);

  deleteLlmJob(repoRoot, job.jobId);
  debugLog(debug === true, "capture-llm", `ok: upgraded ${job.captureFile}`);
  return { ok: true };
}

export async function runLlmJobById(
  repoRoot: string,
  jobId: string,
  debug?: boolean,
): Promise<{ ok: boolean; reason?: string }> {
  const job = readLlmJob(repoRoot, jobId);
  if (!job) {
    return { ok: false, reason: "job not found" };
  }
  return runLlmJob(repoRoot, job, debug);
}

export async function flushPendingLlmJobs(
  repoRoot: string,
  debug?: boolean,
): Promise<number> {
  const jobs = listPendingJobs(repoRoot);
  let done = 0;
  for (const job of jobs) {
    const result = await runLlmJob(repoRoot, job, debug);
    if (result.ok) {
      done += 1;
    }
  }
  return done;
}
