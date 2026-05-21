import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCaptureFile } from "../../src/consolidate/parseCapture.js";
import { detectTopicConflict } from "../../src/promote/detectTopicConflict.js";
import { initPromoteRepo, writeSemanticCapture } from "./helpers.js";

describe("detectTopicConflict", () => {
  it("reports no conflict when topic missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-promote-"));
    initPromoteRepo(dir);
    const rel = writeSemanticCapture(dir, "a.md", { promote: true });
    const cap = readCaptureFile(dir, rel)!;
    const c = detectTopicConflict(dir, cap);
    expect(c.hasConflict).toBe(false);
  });

  it("detects mutex pair against existing topic", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-promote-"));
    initPromoteRepo(dir);
    writeFileSync(
      join(dir, ".memory", "topics", "auth.md"),
      "# auth\n\nPrefer localStorage for tokens\n",
    );
    const rel = writeSemanticCapture(dir, "a.md", {
      promote: true,
      findings: "Use HttpOnly cookies",
      summary: "HttpOnly token storage",
    });
    const cap = readCaptureFile(dir, rel)!;
    const c = detectTopicConflict(dir, cap);
    expect(c.hasConflict).toBe(true);
  });
});
