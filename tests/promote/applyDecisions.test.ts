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
import { applyDecisions } from "../../src/promote/applyDecisions.js";
import { runPromote } from "../../src/promote/runPromote.js";
import { hasPromoteMarker } from "../../src/skills/promoteMarker.js";
import { initPromoteRepo, writeSemanticCapture } from "./helpers.js";

describe("applyDecisions", () => {
  it("approve writes topics and removes marker", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-promote-"));
    initPromoteRepo(dir);
    const rel = writeSemanticCapture(dir, "a.md", { promote: true });

    const pr = await runPromote({ cwd: dir, mode: "pr" });
    expect("prBodyPath" in pr).toBe(true);

    const result = applyDecisions(dir, {
      generatedAt: "2026-05-20",
      decisions: [{ capturePath: rel, action: "approve", target: "topics" }],
    });

    expect(result.approved).toEqual([rel]);
    expect(result.topicsWritten.length).toBeGreaterThan(0);
    expect(existsSync(join(dir, ".memory", "topics", "auth.md"))).toBe(true);
    expect(hasPromoteMarker(dir, rel)).toBe(false);
  });

  it("reject removes marker and annotates capture", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-promote-"));
    initPromoteRepo(dir);
    const rel = writeSemanticCapture(dir, "a.md", { promote: true });

    applyDecisions(dir, {
      generatedAt: "2026-05-20",
      decisions: [
        { capturePath: rel, action: "reject", note: "too personal" },
      ],
    });

    expect(hasPromoteMarker(dir, rel)).toBe(false);
    const content = readFileSync(join(dir, ".memory", rel), "utf8");
    expect(content).toContain("promote_rejected_at:");
  });

  it("defer keeps marker", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-promote-"));
    initPromoteRepo(dir);
    const rel = writeSemanticCapture(dir, "a.md", { promote: true });

    applyDecisions(dir, {
      generatedAt: "2026-05-20",
      decisions: [{ capturePath: rel, action: "defer" }],
    });

    expect(hasPromoteMarker(dir, rel)).toBe(true);
  });
});
