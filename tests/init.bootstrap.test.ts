import { describe, expect, it, vi } from "vitest";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/init/runInit.js";

describe("init bootstrap scan", () => {
  it("init -y --scan writes captures and MEMORY", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-init-boot-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "boot-test",
        dependencies: { react: "18" },
      }),
      "utf8",
    );

    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const report = await runInit({
      yes: true,
      cwd: dir,
      scan: true,
      assistants: ["claude-code"],
      includeExampleTemplates: false,
    });

    const stderrText = stderrSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(stderrText).toMatch(/正在扫描项目并生成首批语义记忆/);
    expect(stderrText).toMatch(/已写入 \d+ 条语义捕获/);
    expect(stderrText).toMatch(/正在整理 MEMORY\.md/);
    expect(stderrText).toMatch(/冷启动完成/);
    stderrSpy.mockRestore();

    expect(report.bootstrapCapturesWritten).toBeGreaterThan(0);
    expect(report.memoryBootstrapped).toBe(true);

    const semanticDir = join(dir, ".memory", "captures", "semantic");
    expect(existsSync(semanticDir)).toBe(true);
    const mdFiles = readdirSync(semanticDir).filter((n) => n.endsWith(".md"));
    expect(mdFiles.length).toBeGreaterThan(0);

    const memory = readFileSync(join(dir, ".memory", "MEMORY.md"), "utf8");
    expect(memory).not.toContain("consolidate 后自动填充");
    expect(memory).toContain("## 活跃主题");
  });

  it("init -y without scan does not write bootstrap captures", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-init-no-scan-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "no-scan" }),
      "utf8",
    );

    const report = await runInit({
      yes: true,
      cwd: dir,
      assistants: ["claude-code"],
      includeExampleTemplates: false,
    });

    expect(report.bootstrapCapturesWritten).toBeUndefined();
    const semanticDir = join(dir, ".memory", "captures", "semantic");
    if (existsSync(semanticDir)) {
      const mdFiles = readdirSync(semanticDir).filter((n) => n.endsWith(".md"));
      expect(mdFiles.length).toBe(0);
    }
  });
});
