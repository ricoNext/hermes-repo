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
import { aggregateRefs } from "../src/feedback/aggregateRefs.js";
import { writeRef } from "../src/feedback/writeRef.js";
import { listRefFiles } from "../src/feedback/listRefs.js";

function seedCapture(dir: string): string {
  const rel = "captures/semantic/capture-2026-05-20-001.md";
  mkdirSync(join(dir, ".memory", "captures", "semantic"), { recursive: true });
  mkdirSync(join(dir, ".memory", "refs"), { recursive: true });
  writeFileSync(
    join(dir, ".memory", rel),
    `---
type: semantic
date: 2026-05-20
tags: [auth]
---

## 发现

token storage
`,
  );
  return rel;
}

describe("feedback", () => {
  it("writeRef and aggregateRefs updates capture and deletes refs", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-ref-"));
    const rel = seedCapture(dir);

    writeRef({
      repoRoot: dir,
      capture: rel,
      reason: "check convention",
      date: "2026-05-21",
    });
    writeRef({
      repoRoot: dir,
      capture: rel,
      reason: "second read",
      date: "2026-05-22",
    });
    expect(listRefFiles(dir).length).toBeGreaterThanOrEqual(2);

    const result = aggregateRefs(dir);
    expect(result.refsAggregated).toBe(2);
    expect(result.capturesUpdated).toBe(1);
    expect(listRefFiles(dir).length).toBe(0);

    const raw = readFileSync(join(dir, ".memory", rel), "utf8");
    expect(raw).toContain("use_count: 2");
    expect(raw).toContain("last_used: 2026-05-22");
  });

  it("aggregateRefs dry-run does not delete refs", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-ref-dry-"));
    const rel = seedCapture(dir);
    writeRef({ repoRoot: dir, capture: rel, reason: "x", date: "2026-05-21" });
    aggregateRefs(dir, true);
    expect(listRefFiles(dir).length).toBe(1);
  });
});
