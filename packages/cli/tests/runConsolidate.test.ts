import {
  describe, expect, it, vi, beforeEach, afterEach,
} from "vitest";
import {
  existsSync,
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
import { configureDebugLogging } from "../src/config/debugLog.js";

const tempDirs: string[] = [];
const originalFetch = globalThis.fetch;

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
    },
    consolidate: {
      autoArchiveDays: 30,
      autoFlush: {
        enabled: false,
        minPendingSessions: 3,
        minIntervalMinutes: 30,
        maxPendingChars: 20_000,
      },
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
  globalThis.fetch = originalFetch;
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function llmConfig(): HermesConfig["llm"] {
  return {
    enabled: true,
    provider: "openai",
    baseUrl: "https://api.example/v1",
    model: "m",
    apiKey: "k",
    timeoutMs: 60_000,
    maxInputChars: 24_000,
  };
}

function mockLlmResult(result: unknown): void {
  globalThis.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(result) } }],
      }),
    }) as Response;
}

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

  it("writes MEMORY.md only when linked knowledge files exist", async () => {
    const dir = makeV2Repo({ llm: llmConfig() });
    writePendingSession(dir, "sess-ok", "Canvas interaction rule.");
    mockLlmResult({
      knowledgeFiles: [
        {
          targetPath: "domains/canvas/canvas-interaction.md",
          action: "create",
          frontmatter: {
            title: "Canvas interaction",
            domain: "canvas",
            type: "domain-knowledge",
            status: "active",
            confidence: "high",
          },
          body: "Canvas interaction notes.",
        },
      ],
      memoryMd:
        "# 项目知识库\n\n[Canvas interaction](domains/canvas/canvas-interaction.md)",
      skippedSessions: [],
    });

    const result = await runConsolidate({
      repoRoot: dir,
      config: JSON.parse(readFileSync(join(dir, ".memory", "config.json"), "utf8")),
    });

    expect(result.ran).toBe(true);
    expect(existsSync(join(dir, ".memory", "domains", "canvas", "canvas-interaction.md"))).toBe(true);
    expect(readFileSync(join(dir, ".memory", "MEMORY.md"), "utf8")).toContain(
      "domains/canvas/canvas-interaction.md",
    );
  });

  it("writes detailed LLM request and response logs when debug is enabled", async () => {
    const dir = makeV2Repo({ llm: llmConfig() });
    configureDebugLogging(dir, true);
    writePendingSession(dir, "sess-llm-log", "Canvas interaction rule.");
    mockLlmResult({
      knowledgeFiles: [
        {
          targetPath: "domains/canvas/canvas-interaction.md",
          action: "create",
          frontmatter: {
            title: "Canvas interaction",
            domain: "canvas",
            type: "domain-knowledge",
            status: "active",
            confidence: "high",
          },
          body: "Canvas interaction notes.",
        },
      ],
      memoryMd:
        "# 项目知识库\n\n[Canvas interaction](domains/canvas/canvas-interaction.md)",
      skippedSessions: [],
    });

    await runConsolidate({
      repoRoot: dir,
      config: JSON.parse(readFileSync(join(dir, ".memory", "config.json"), "utf8")),
      debug: true,
    });

    const log = readFileSync(join(dir, ".memory", "logs", "consolidate.log"), "utf8");
    expect(log).toContain("hermes-repo [llm] request:");
    expect(log).toContain("hermes-repo [llm] response json BEGIN");
    expect(log).toContain("hermes-repo [llm] raw message content BEGIN");
    expect(log).toContain("hermes-repo [llm] normalized knowledgeFiles BEGIN");
    expect(log).toContain("domains/canvas/canvas-interaction.md");
    expect(log).not.toContain("Bearer k");
  });

  it("accepts LLM knowledge files that use path and YAML frontmatter", async () => {
    const dir = makeV2Repo({ llm: llmConfig() });
    writePendingSession(dir, "sess-path", "Canvas interaction and quotation incident.");
    mockLlmResult({
      knowledgeFiles: [
        {
          path: "domains/canvas/canvas-interaction.md",
          action: "create",
          frontmatter:
            "---\ntitle: 画布交互\ntype: domain-knowledge\ndomain: canvas\ntags: [canvas, interaction]\n---",
          body: "Canvas interaction notes.",
        },
        {
          path: "incidents/2026-06-26-save-common-quotation-planId.md",
          action: "create",
          frontmatter:
            "---\ntitle: 保存常用报价误传 planId\ntype: incident\ndomain: quoted\n---",
          body: "Quotation incident notes.",
        },
      ],
      memoryMd:
        "# 项目知识库\n\n[Canvas](domains/canvas/canvas-interaction.md)\n\n[Incident](incidents/2026-06-26-save-common-quotation-planId.md)",
      skippedSessions: [],
    });

    const result = await runConsolidate({
      repoRoot: dir,
      config: JSON.parse(readFileSync(join(dir, ".memory", "config.json"), "utf8")),
    });

    expect(result.knowledgeCreated).toBe(2);
    const domainFile = readFileSync(
      join(dir, ".memory", "domains", "canvas", "canvas-interaction.md"),
      "utf8",
    );
    const incidentFile = readFileSync(
      join(dir, ".memory", "incidents", "2026-06-26-save-common-quotation-planId.md"),
      "utf8",
    );
    expect(domainFile).toContain("title: 画布交互");
    expect(domainFile).toContain("tags: [canvas, interaction]");
    expect(incidentFile).toContain("title: 保存常用报价误传 planId");
  });

  it("fails before updating MEMORY.md when it links missing knowledge files", async () => {
    const dir = makeV2Repo({ llm: llmConfig() });
    writePendingSession(dir, "sess-missing", "Canvas interaction rule.");
    const originalMemory = readFileSync(join(dir, ".memory", "MEMORY.md"), "utf8");
    mockLlmResult({
      knowledgeFiles: [],
      memoryMd:
        "# 项目知识库\n\n[Canvas interaction](domains/canvas/canvas-interaction.md)",
      skippedSessions: [],
    });

    await expect(
      runConsolidate({
        repoRoot: dir,
        config: JSON.parse(readFileSync(join(dir, ".memory", "config.json"), "utf8")),
      }),
    ).rejects.toThrow("MEMORY.md 引用了不存在的知识文件");

    expect(readFileSync(join(dir, ".memory", "MEMORY.md"), "utf8")).toBe(originalMemory);
    expect(readFileSync(join(dir, ".memory", "captures", "raw", "session-sess-missing.md"), "utf8")).toContain(
      "status: pending",
    );
  });
});
