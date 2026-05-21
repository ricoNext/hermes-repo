import { describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runConsolidate } from "../src/consolidate/runConsolidate.js";

function seedRepo(dir: string, count: number): void {
  mkdirSync(join(dir, ".memory", "captures", "semantic"), { recursive: true });
  mkdirSync(join(dir, ".memory", "topics"), { recursive: true });
  writeFileSync(
    join(dir, ".memory", "config.json"),
    `${JSON.stringify({ version: 1, storage: { backend: "file" }, assistants: ["claude-code"], debug: false })}\n`,
  );
  for (let i = 1; i <= count; i++) {
    writeFileSync(
      join(
        dir,
        ".memory",
        "captures",
        "semantic",
        `capture-2026-05-20-${String(i).padStart(3, "0")}.md`,
      ),
      `---
type: semantic
date: 2026-05-20
session: s${i}
tags: [auth, convention]
scope: all
confidence: pending
---

## 发现

Authentication uses httpOnly cookies for session ${i}

## 影响

Safer than localStorage
`,
    );
  }
}

describe("runConsolidate", () => {
  it("writes MEMORY.md and topics without llm", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-cons-"));
    seedRepo(dir, 3);
    const result = await runConsolidate({
      repoRoot: dir,
      manual: true,
    });
    expect(result.ran).toBe(true);
    expect(result.memoryUpdated).toBe(true);
    expect(result.skillsWritten).toBe(0);

    const memory = readFileSync(join(dir, ".memory", "MEMORY.md"), "utf8");
    expect(memory).toContain("## 活跃主题");
    expect(memory).not.toContain("consolidate 后自动填充");
    expect(existsSync(join(dir, ".memory", "topics", "auth.md"))).toBe(true);
  });
});
