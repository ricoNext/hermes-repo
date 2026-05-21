import { spawnSync } from "node:child_process";
import {
  existsSync,
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

function seed(dir: string): void {
  mkdirSync(join(dir, ".memory", "captures", "semantic"), { recursive: true });
  writeFileSync(
    join(dir, ".memory", "config.json"),
    `${JSON.stringify({ version: 1, storage: { backend: "file" }, assistants: ["claude-code"], debug: false })}\n`,
  );
  writeFileSync(
    join(dir, ".memory", "captures", "semantic", "capture-2026-05-20-001.md"),
    `---
type: semantic
date: 2026-05-20
session: s1
tags: [deploy]
scope: all
confidence: pending
---

## 发现

Deploy uses pnpm
`,
  );
}

describe("flush CLI", () => {
  it("exits 0 and updates MEMORY", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-flush-"));
    seed(dir);
    const r = spawnSync(process.execPath, [cliPath, "flush", "-C", dir], {
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
    const memory = readFileSync(join(dir, ".memory", "MEMORY.md"), "utf8");
    expect(memory).toContain("项目记忆");
  });

  it("dry-run does not require MEMORY pre-exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-flush-dry-"));
    seed(dir);
    const r = spawnSync(
      process.execPath,
      [cliPath, "flush", "-C", dir, "--dry-run"],
      { encoding: "utf8" },
    );
    expect(r.status).toBe(0);
    expect(existsSync(join(dir, ".memory", "MEMORY.md"))).toBe(false);
  });
});
