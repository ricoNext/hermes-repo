import { describe, expect, it, vi, afterEach } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listAllCaptures } from "../src/consolidate/listCaptures.js";
import {
  isMemoryEligible,
  shouldArchiveCapture,
} from "../src/lifecycle/memoryEligibility.js";
import { applyLifecycle } from "../src/lifecycle/applyLifecycle.js";
import type { ParsedCapture } from "../src/consolidate/parseCapture.js";

function captureFixture(overrides: Partial<ParsedCapture> = {}): ParsedCapture {
  return {
    path: "captures/semantic/old.md",
    absolutePath: "/tmp/.memory/captures/semantic/old.md",
    type: "semantic",
    date: "2020-01-01",
    session: "s",
    tags: ["auth"],
    scope: "all",
    confidence: "pending",
    bodyMarkdown: "",
    findings: "",
    summary: "old",
    ...overrides,
  };
}

describe("lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("isMemoryEligible for recent date", () => {
    vi.setSystemTime(new Date("2026-05-20T12:00:00Z"));
    expect(isMemoryEligible(captureFixture({ date: "2026-05-15" }))).toBe(true);
  });

  it("isMemoryEligible false for old without last_used", () => {
    vi.setSystemTime(new Date("2026-05-20T12:00:00Z"));
    expect(isMemoryEligible(captureFixture({ date: "2020-01-01" }))).toBe(false);
  });

  it("isMemoryEligible true when last_used recent", () => {
    vi.setSystemTime(new Date("2026-05-20T12:00:00Z"));
    expect(
      isMemoryEligible(
        captureFixture({ date: "2020-01-01", lastUsed: "2026-05-18", useCount: 1 }),
      ),
    ).toBe(true);
  });

  it("shouldArchiveCapture when idle 90+ days", () => {
    vi.setSystemTime(new Date("2026-05-20T12:00:00Z"));
    const dir = mkdtempSync(join(tmpdir(), "hermes-life-"));
    const c = captureFixture({ date: "2020-01-01" });
    expect(shouldArchiveCapture(c, dir)).toBe(true);
  });

  it("applyLifecycle archives on ignore marker", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-ignore-"));
    const rel = "captures/semantic/capture-2026-05-20-001.md";
    mkdirSync(join(dir, ".memory", "captures", "semantic"), { recursive: true });
    writeFileSync(
      join(dir, ".memory", rel),
      `---
type: semantic
date: 2026-05-20
tags: [x]
---

## 发现

x
`,
    );
    writeFileSync(join(dir, ".memory", `${rel}.ignore`), "");
    const all = listAllCaptures(dir);
    const result = applyLifecycle(dir, all);
    expect(result.archived).toBe(1);
    expect(existsSync(join(dir, ".memory", ".archive", rel))).toBe(true);
    expect(existsSync(join(dir, ".memory", rel))).toBe(false);
  });
});
