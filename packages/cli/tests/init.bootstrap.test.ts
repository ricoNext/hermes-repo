import { describe, expect, it } from "vitest";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/init/runInit.js";

describe("init bootstrap (v2)", () => {
  it("init -y completes successfully without scan option", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-init-boot-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "boot-test",
        dependencies: { react: "18" },
      }),
      "utf8",
    );

    // v2: InitResolvedOptions 没有 scan/bootstrapFromScan 字段
    const report = await runInit({
      yes: true,
      cwd: dir,
      assistants: ["claude-code"],
      includeExampleTemplates: false,
    });

    // v2: init 成功完成
    expect(existsSync(join(dir, ".memory"))).toBe(true);
    expect(existsSync(join(dir, ".memory", "config.json"))).toBe(true);
    expect(existsSync(join(dir, "AGENTS.md"))).toBe(true);
  });

  it("init -y creates expected v2 directory structure", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-init-v2-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "v2-structure" }),
      "utf8",
    );

    const report = await runInit({
      yes: true,
      cwd: dir,
      assistants: ["codebuddy"],
      includeExampleTemplates: false,
    });

    // v2: 检查核心文件和目录
    expect(existsSync(join(dir, ".memory", "config.json"))).toBe(true);
    expect(existsSync(join(dir, ".memory", "MEMORY.md"))).toBe(true);
    expect(existsSync(join(dir, ".memory", "captures"))).toBe(true);
    expect(existsSync(join(dir, ".memory", "rules"))).toBe(true);
    expect(existsSync(join(dir, "AGENTS.md"))).toBe(true);
  });
});
