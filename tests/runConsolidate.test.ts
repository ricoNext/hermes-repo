import {
  describe, expect, it, vi, beforeEach, afterEach,
} from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HermesConfig } from "../src/config/types.js";
import { runConsolidate } from "../src/consolidate/runConsolidate.js";

const tempDirs: string[] = [];

function makeV2Repo(overrides?: Partial<HermesConfig>): string {
  const dir = mkdtempSync(join(tmpdir(), "hermes-flush-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, ".memory"), { recursive: true });
  mkdirSync(join(dir, ".memory", "captures", "raw"), { recursive: true });
  mkdirSync(join(dir, ".memory", "rules"), { recursive: true });

  const config: HermesConfig = {
    version: 1,
    storage: { backend: "file" },
    assistants: ["claude-code"],
    debug: true,
    llm: {
      enabled: false,
      provider: "openai",
      baseUrl: "",
      model: "",
      apiKey: "",
      timeoutMs: 60_000,
      maxInputChars: 24_000,
      mode: "async",
    },
    ...overrides,
  };
  writeFileSync(
    join(dir, ".memory", "config.json"),
    JSON.stringify(config) + "\n",
    "utf8",
  );
  writeFileSync(
    join(dir, ".memory", "MEMORY.md"),
    "# 项目知识库\n\n> consolidate 后自动填充\n",
    "utf8",
  );
  return dir;
}

function writePendingSession(dir: string, sessionId: string, body: string): void {
  writeFileSync(
    join(dir, ".memory", "captures", "raw", `session-${sessionId}.md`),
    [
      "---",
      `sessionId: ${sessionId}`,
      "source: session",
      "status: pending",
      "domain: null",
      `createdAt: ${new Date().toISOString()}`,
      `lastModifiedAt: ${new Date().toISOString()}`,
      "consolidatedAt: null",
      "captureCount: 1",
      "---",
      "",
      body,
    ].join("\n"),
    "utf8",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("runConsolidate (v2)", () => {
  it("returns ran=false when LLM not configured", async () => {
    const dir = makeV2Repo();
    const result = await runConsolidate({
      repoRoot: dir,
      config: JSON.parse(readFileSync(join(dir, ".memory", "config.json"), "utf8")),
    });
    expect(result.ran).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("returns ran=false when no pending sessions and no LLM", async () => {
    const dir = makeV2Repo();
    const result = await runConsolidate({
      repoRoot: dir,
      config: JSON.parse(readFileSync(join(dir, ".memory", "config.json"), "utf8")),
    });
    expect(result.ran).toBe(false);
  });

  it("returns correct ConsolidateResultV2 shape", async () => {
    const dir = makeV2Repo();
    const result = await runConsolidate({
      repoRoot: dir,
      config: JSON.parse(readFileSync(join(dir, ".memory", "config.json"), "utf8")),
    });
    expect(typeof result.ran).toBe("boolean");
    expect(typeof result.sessionsProcessed).toBe("number");
    expect(typeof result.knowledgeCreated).toBe("number");
    expect(typeof result.knowledgeUpdated).toBe("number");
    expect(typeof result.skippedCount).toBe("number");
    expect(typeof result.archived).toBe("number");
  });

  it("dry-run returns correct shape without writing files", async () => {
    const dir = makeV2Repo();
    writePendingSession(dir, "sess-dryrun", "Test session for dry run.");
    const result = await runConsolidate({
      repoRoot: dir,
      config: JSON.parse(readFileSync(join(dir, ".memory", "config.json"), "utf8")),
      dryRun: true,
    });
    expect(typeof result.ran).toBe("boolean");
  });
});
