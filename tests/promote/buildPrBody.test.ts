import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeCandidate } from "../../src/promote/analyzeCandidate.js";
import { buildPrBody } from "../../src/promote/buildPrBody.js";
import { listPromoteCandidates } from "../../src/promote/listPromoteCandidates.js";
import { initPromoteRepo, writeSemanticCapture } from "./helpers.js";

describe("buildPrBody", () => {
  it("fills placeholders and item sections", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-promote-"));
    initPromoteRepo(dir);
    writeSemanticCapture(dir, "a.md", { promote: true });
    const candidates = listPromoteCandidates(dir);
    const analysis = await analyzeCandidate(dir, candidates[0]!, null);
    const body = buildPrBody(dir, [analysis]);
    expect(body).toContain("1 条");
    expect(body).toContain("captures/semantic/a.md");
    expect(body).toContain("批准晋升");
  });
});
