import { afterEach, describe, expect, it, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInject } from "../src/inject/runInject.js";
import { INJECT_MAX_CHARS } from "../src/inject/constants.js";

const tempDirs: string[] = [];

function makeInitializedRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "hermes-inj-"));
  tempDirs.push(dir);
  mkdirSync(join(dir, ".memory"), { recursive: true });
  mkdirSync(join(dir, ".memory", "rules"), { recursive: true });
  writeFileSync(
    join(dir, ".memory", "config.json"),
    JSON.stringify({ assistants: ["codebuddy"], debug: true }) + "\n",
    "utf8",
  );
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("inject", () => {
  it("exit 0 when not initialized", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-inj-"));
    tempDirs.push(dir);
    const result = runInject(dir);
    expect(result.injected).toBe(false);
    expect(result.chars).toBe(0);
  });

  it("logs debug when MEMORY missing and debug enabled", () => {
    const dir = makeInitializedRepo();
    // 没有 MEMORY.md 且没有 rules/
    // v2: debugLog 写入文件而非 console.error，所以 console.error 不应被调用
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    runInject(dir);
    // stdout 不应有输出（因为没有内容可注入）
    const calls = spy.mock.calls.map((c) => String(c[0]));
    const output = calls.join("");
    expect(output.length).toBe(0);
    spy.mockRestore();
  });

  it("outputs MEMORY.md after init-like content", () => {
    const dir = makeInitializedRepo();
    writeFileSync(join(dir, ".memory", "MEMORY.md"), "# 项目知识库\n\n最后更新: 2026-06-23\n\n## 必读规则\n", "utf8");
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const result = runInject(dir);
    expect(result.injected).toBe(true);
    expect(result.chars).toBeGreaterThan(0);
    // v2: 输出包含 MEMORY.md 内容
    const calls = spy.mock.calls.map((c) => String(c[0]));
    const output = calls.join("");
    expect(output).toContain("项目知识库");
    spy.mockRestore();
  });

  it("outputs additional_context JSON for cursor hook mode", () => {
    const dir = makeInitializedRepo();
    writeFileSync(join(dir, ".memory", "MEMORY.md"), "# Memory\n\nSome context.\n", "utf8");
    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const result = runInject(dir, { cursorHookOutput: true });
    expect(result.injected).toBe(true);
    const calls = spy.mock.calls.map((c) => String(c[0]));
    const output = calls.join("");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("additional_context");
    expect(parsed.additional_context).toContain("Memory");
    spy.mockRestore();
  });

  it("truncates long content at INJECT_MAX_CHARS", () => {
    const dir = makeInitializedRepo();
    // 写入超长 MEMORY.md (>8000 字符)
    const longContent = "# Big Memory\n\n" + "x".repeat(INJECT_MAX_CHARS + 100);
    writeFileSync(join(dir, ".memory", "MEMORY.md"), longContent, "utf8");

    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const result = runInject(dir);
    expect(result.injected).toBe(true);
    // v2: 上限是 INJECT_MAX_CHARS (8000)
    expect(result.chars).toBeLessThanOrEqual(INJECT_MAX_CHARS + 50);

    const calls = spy.mock.calls.map((c) => String(c[0]));
    const output = calls.join("");
    expect(output).toContain("truncated");
    spy.mockRestore();
  });

  it("includes rules files in output", () => {
    const dir = makeInitializedRepo();
    writeFileSync(join(dir, ".memory", "MEMORY.md"), "# Memory\n\nNav only.\n", "utf8");
    // 写一个 rule 文件
    writeFileSync(
      join(dir, ".memory", "rules", "coding.md"),
      "# 编码规范\n\n- 使用 TypeScript strict mode\n- 命名用 camelCase\n",
      "utf8",
    );

    const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const result = runInject(dir);
    expect(result.injected).toBe(true);

    const calls = spy.mock.calls.map((c) => String(c[0]));
    const output = calls.join("");
    // v2: 输出应包含 rules 全文和分隔符
    expect(output).toContain("---");
    expect(output).toContain("必读规则全文");
    expect(output).toContain("编码规范");
    expect(output).toContain("TypeScript strict mode");
    spy.mockRestore();
  });
});
