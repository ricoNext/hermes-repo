import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { runLlmJobById } from "../src/capture/runLlmJob.js";
import { commitCapture } from "../src/capture/commitCapture.js";
import { parseJsonlFile } from "../src/capture/claude-code/parseJsonl.js";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const tempDirs: string[] = [];

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const d of tempDirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

function makeRepoWithLlm(): string {
  const dir = mkdtempSync(join(tmpdir(), "hermes-llm-cap-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, ".memory", "captures", "episodic"), {
    recursive: true,
  });
  mkdirSync(join(dir, ".memory", "sessions"), { recursive: true });
  writeFileSync(
    join(dir, ".memory", "config.json"),
    `${JSON.stringify({
      version: 1,
      storage: { backend: "file" },
      assistants: ["claude-code"],
      debug: false,
    })}\n`,
  );
  writeFileSync(
    join(dir, ".memory", "llm.json"),
    `${JSON.stringify({
      enabled: true,
      provider: "openai",
      baseUrl: "https://api.example/v1",
      model: "m",
      apiKey: "k",
      timeoutMs: 5000,
      maxInputChars: 8000,
      mode: "async",
    })}\n`,
  );
  writeFileSync(
    join(dir, ".memory", "sessions", "index.json"),
    `${JSON.stringify({ version: 1, sessions: [] })}\n`,
  );
  return dir;
}

// helper to write job manually
function writeJob(
  repoRoot: string,
  jobId: string,
  captureFile: string,
  jsonlPath: string,
): void {
  const pending = join(repoRoot, ".memory", "captures", "pending");
  mkdirSync(pending, { recursive: true });
  writeFileSync(
    join(pending, `${jobId}.json`),
    `${JSON.stringify({
      jobId,
      sessionId: "sess-1",
      jsonlPath,
      captureFile,
      assistant: "claude-code",
      enqueuedAt: new Date().toISOString(),
    })}\n`,
  );
}

describe("capture-llm", () => {
  it("upgrades capture file via runLlmJobById", async () => {
    const dir = makeRepoWithLlm();
    const fixture = join(fixturesDir, "session-rich.jsonl");

    globalThis.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  type: "episodic",
                  tags: ["debug"],
                  scope: "all",
                  context: "调试会话",
                  findings: "根因是配置错误",
                  impact: "更新文档",
                }),
              },
            },
          ],
        }),
      }) as Response;

    const prev = process.env.HERMES_SESSION_JSONL;
    process.env.HERMES_SESSION_JSONL = fixture;
    const result = await commitCapture({
      repoRoot: dir,
      session: parseJsonlFile(fixture),
      jsonlPath: fixture,
      assistant: "claude-code",
    });
    process.env.HERMES_SESSION_JSONL = prev;

    expect(result.written).toBe(true);
    const captureFile = result.capturePath!;
    const before = readFileSync(join(dir, captureFile), "utf8");
    expect(before).not.toContain("llmUpgradedAt:");

    const jobId = "test-job-1";
    writeJob(dir, jobId, captureFile, fixture);

    const run = await runLlmJobById(dir, jobId, true);
    expect(run.ok).toBe(true);

    const after = readFileSync(join(dir, captureFile), "utf8");
    expect(after).toContain("llmUpgradedAt:");
    expect(after).toContain("根因是配置错误");
  });
});
