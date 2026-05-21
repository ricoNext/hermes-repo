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
import { writeRef } from "../src/feedback/writeRef.js";

describe("flush feedback integration", () => {
  it("aggregates refs on flush and updates MEMORY", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-flush-ref-"));
    const rel = "captures/semantic/capture-2026-05-20-001.md";
    mkdirSync(join(dir, ".memory", "captures", "semantic"), { recursive: true });
    mkdirSync(join(dir, ".memory", "topics"), { recursive: true });
    writeFileSync(
      join(dir, ".memory", "config.json"),
      `${JSON.stringify({ version: 1, storage: { backend: "file" }, assistants: ["claude-code"], debug: false })}\n`,
    );
    writeFileSync(
      join(dir, ".memory", rel),
      `---
type: semantic
date: 2026-05-20
session: s1
tags: [auth, convention]
scope: all
confidence: pending
---

## 发现

Recent auth note for MEMORY
`,
    );

    writeRef({
      repoRoot: dir,
      capture: rel,
      reason: "review",
      date: "2026-05-20",
    });

    const result = await runConsolidate({ repoRoot: dir, manual: true });
    expect(result.refsAggregated).toBe(1);
    const raw = readFileSync(join(dir, ".memory", rel), "utf8");
    expect(raw).toContain("use_count: 1");
    expect(existsSync(join(dir, ".memory", "MEMORY.md"))).toBe(true);
  });
});
