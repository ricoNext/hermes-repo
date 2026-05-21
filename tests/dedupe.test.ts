import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dedupeCaptures } from "../src/consolidate/dedupe.js";
import { parseCaptureMarkdown } from "../src/consolidate/parseCapture.js";

function writeCapture(
  dir: string,
  name: string,
  findings: string,
  date: string,
): string {
  const rel = `captures/semantic/${name}`;
  const content = `---
type: semantic
date: ${date}
session: s1
tags: [auth, auto-capture]
scope: all
confidence: pending
---

## 发现

${findings}
`;
  const abs = join(dir, ".memory", rel);
  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, content, "utf8");
  return rel;
}

describe("dedupe", () => {
  it("marks similar capture as superseded", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-dedupe-"));
    const rel1 = writeCapture(
      dir,
      "capture-2026-05-20-001.md",
      "Use httpOnly cookie for auth tokens",
      "2026-05-20",
    );
    const rel2 = writeCapture(
      dir,
      "capture-2026-05-20-002.md",
      "Use httpOnly cookie for auth tokens",
      "2026-05-19",
    );
    const abs1 = join(dir, ".memory", rel1);
    const abs2 = join(dir, ".memory", rel2);
    const c1 = parseCaptureMarkdown(
      readFileSync(abs1, "utf8"),
      rel1,
      abs1,
    )!;
    const c2 = parseCaptureMarkdown(
      readFileSync(abs2, "utf8"),
      rel2,
      abs2,
    )!;
    const { active, supersededPaths } = dedupeCaptures([c1, c2]);
    expect(active.length).toBe(1);
    expect(supersededPaths.length).toBe(1);
    const raw2 = readFileSync(abs2, "utf8");
    expect(raw2).toContain("confidence: superseded");
  });
});
