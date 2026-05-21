import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collectStats } from "../src/stats/runStats.js";

describe("stats", () => {
  it("collects capture counts", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-stats-"));
    mkdirSync(join(dir, ".memory", "captures", "semantic"), { recursive: true });
    writeFileSync(
      join(dir, ".memory", "captures", "semantic", "capture-2026-05-20-001.md"),
      `---
type: semantic
date: 2026-05-20
tags: [a]
use_count: 0
---

## 发现

x
`,
    );
    writeFileSync(join(dir, ".memory", "MEMORY.md"), "# 项目记忆\n");

    const s = collectStats(dir);
    expect(s.capturesTotal).toBe(1);
    expect(s.zeroUseCount).toBe(1);
    expect(s.memoryBytes).toBeGreaterThan(0);
  });
});
