import { describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shouldRunConsolidate } from "../src/consolidate/shouldRunConsolidate.js";
import { writeConsolidateState } from "../src/consolidate/state.js";

function initRepo(dir: string): void {
  mkdirSync(join(dir, ".memory", "captures", "semantic"), {
    recursive: true,
  });
  writeFileSync(
    join(dir, ".memory", "config.json"),
    `${JSON.stringify({ version: 1, storage: { backend: "file" }, assistants: ["claude-code"], debug: false })}\n`,
  );
}

function addCapture(dir: string, n: number): void {
  const name = `capture-2026-05-20-${String(n).padStart(3, "0")}.md`;
  writeFileSync(
    join(dir, ".memory", "captures", "semantic", name),
    `---
type: semantic
date: 2026-05-20
session: s${n}
tags: [t${n}]
scope: all
confidence: pending
---

## 发现

fact ${n}
`,
  );
}

describe("shouldRunConsolidate", () => {
  it("triggers on count threshold", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-should-"));
    initRepo(dir);
    writeConsolidateState(dir, {
      version: 1,
      lastConsolidatedAt: new Date().toISOString(),
      processedCapturePaths: [],
    });
    for (let i = 1; i <= 10; i++) {
      addCapture(dir, i);
    }
    const r = shouldRunConsolidate({ repoRoot: dir });
    expect(r.shouldRun).toBe(true);
    expect(r.reason).toBe("count");
  });

  it("manual always runnable with captures", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-should-m-"));
    initRepo(dir);
    addCapture(dir, 1);
    const r = shouldRunConsolidate({ repoRoot: dir, manual: true });
    expect(r.shouldRun).toBe(true);
  });
});
