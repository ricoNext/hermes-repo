import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listPromoteCandidates } from "../../src/promote/listPromoteCandidates.js";
import { initPromoteRepo, writeSemanticCapture } from "./helpers.js";

describe("listPromoteCandidates", () => {
  it("returns empty when no markers", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-promote-"));
    initPromoteRepo(dir);
    writeSemanticCapture(dir, "a.md", { promote: false });
    expect(listPromoteCandidates(dir)).toHaveLength(0);
  });

  it("lists captures with .promote sidecar", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-promote-"));
    initPromoteRepo(dir);
    writeSemanticCapture(dir, "a.md", { promote: true });
    writeSemanticCapture(dir, "b.md", { promote: false });
    const list = listPromoteCandidates(dir);
    expect(list).toHaveLength(1);
    expect(list[0]?.path).toBe("captures/semantic/a.md");
  });
});
