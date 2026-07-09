import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = join(rootDir, "dist", "cli.js");

/** v2: 创建 raw/ 目录下的 session 文件 */
function seedV2(dir: string): void {
  mkdirSync(join(dir, ".memory", "captures", "raw"), { recursive: true });
  writeFileSync(
    join(dir, ".memory", "config.json"),
    `${JSON.stringify({
      assistants: ["claude-code"],
      debug: false,
      consolidate: {
        autoArchiveDays: 30,
        autoFlush: {
          enabled: false,
          minPendingSessions: 3,
          minIntervalMinutes: 30,
          maxPendingChars: 20000,
        },
      },
    })}\n`,
  );
  // 写入 v2 格式的 session 文件
  writeFileSync(
    join(dir, ".memory", "captures", "raw", "session-sess001.md"),
    [
      "---",
      "sessionId: sess001",
      "source: session",
      "status: pending",
      "domain: null",
      "createdAt: 2026-06-23T10:00:00.000Z",
      "lastModifiedAt: 2026-06-23T10:00:00.000Z",
      "consolidatedAt: null",
      "captureCount: 1",
      "---",
      "",
      "# Capture #1",
      "讨论了项目使用 pnpm 部署。",
    ].join("\n"),
  );
  // MEMORY.md 必须存在（flush 会读取它）
  writeFileSync(
    join(dir, ".memory", "MEMORY.md"),
    "# 项目知识库\n\n最后更新: —\n\n## 必读规则\n\n（consolidate 后自动填充）\n",
  );
}

describe("flush CLI (v2)", () => {
  it("exits 0 when flush runs (may not update MEMORY without LLM)", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-flush-"));
    seedV2(dir);
    const r = spawnSync(process.execPath, [cliPath, "flush", "-C", dir], {
      encoding: "utf8",
    });
    // v2: flush 应该退出 0（即使 LLM 未配置也只是报 warning）
    expect(r.status).toBe(0);
  });

  it("dry-run exits 0 without modifying files", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-flush-dry-"));
    seedV2(dir);
    const r = spawnSync(
      process.execPath,
      [cliPath, "flush", "-C", dir, "--dry-run"],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(0);
    // dry-run 不应创建新文件
    // MEMORY.md 已由 seed 创建，检查其内容未被修改
    const memory = readFileSync(join(dir, ".memory", "MEMORY.md"), "utf8");
    expect(memory).toContain("consolidate 后自动填充");
  });

  it("writes flush progress to debug log when debug is enabled", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-flush-debug-"));
    seedV2(dir);
    const configPath = join(dir, ".memory", "config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    config.debug = true;
    config.llm = {
      enabled: true,
      provider: "openai",
      baseUrl: "https://api.example/v1",
      model: "m",
      apiKey: "k",
      timeoutMs: 60_000,
      maxInputChars: 24_000,
    };
    writeFileSync(configPath, `${JSON.stringify(config)}\n`);

    const r = spawnSync(
      process.execPath,
      [cliPath, "flush", "-C", dir, "--dry-run"],
      { encoding: "utf8" },
    );

    expect(r.status).toBe(0);
    const flushLog = readFileSync(join(dir, ".memory", "logs", "flush.log"), "utf8");
    const consolidateLog = readFileSync(join(dir, ".memory", "logs", "consolidate.log"), "utf8");
    expect(flushLog).toContain("hermes-repo [flush] start");
    expect(flushLog).toContain("hermes-repo [flush] result");
    expect(consolidateLog).toContain("hermes-repo [consolidate] start");
    expect(consolidateLog).toContain("dry-run: would process");
  });
});
