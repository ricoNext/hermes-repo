import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSearch } from "../src/search/runSearch.js";

describe("search", () => {
  it("finds keyword in captures", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-search-"));
    mkdirSync(join(dir, ".memory", "captures", "semantic"), { recursive: true });
    writeFileSync(
      join(dir, ".memory", "captures", "semantic", "capture-2026-05-20-001.md"),
      `---
type: semantic
date: 2026-05-20
tags: [deploy]
---

## 发现

production deploy checklist
`,
    );

    const hits = runSearch({
      repoRoot: dir,
      keyword: "deploy",
      limit: 10,
    });
    expect(hits.length).toBe(1);
    expect(hits[0].path).toContain("capture-2026-05-20-001.md");
  });
});
