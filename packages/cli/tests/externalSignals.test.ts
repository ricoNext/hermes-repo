import { describe, it, expect } from "vitest";
import {
  analyzeExternalSignals,
  scoreExternalSignals,
  shouldRejectByExternalSignals,
} from "../src/capture/externalSignals.js";
import type { ParsedSession } from "../src/capture/types.js";

describe("external signals (fix 2)", () => {
  it("detects CI passed signal", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [],
      text: "",
      fileChanges: 1,
      toolCalls: 0,
      ciStatus: "passed",
    };

    const signals = analyzeExternalSignals(session);
    expect(signals.hasCIPassed).toBe(true);
    expect(signals.hasCIFailed).toBe(false);
  });

  it("detects CI failed signal", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [],
      text: "",
      fileChanges: 1,
      toolCalls: 0,
      ciStatus: "failed",
    };

    const signals = analyzeExternalSignals(session);
    expect(signals.hasCIFailed).toBe(true);
    expect(signals.hasCIPassed).toBe(false);
  });

  it("scores CI passed as positive", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [],
      text: "",
      fileChanges: 1,
      toolCalls: 0,
      ciStatus: "passed",
    };

    const score = scoreExternalSignals(session);
    expect(score).toBeGreaterThan(0);
  });

  it("scores CI failed as negative", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [],
      text: "",
      fileChanges: 1,
      toolCalls: 0,
      ciStatus: "failed",
    };

    const score = scoreExternalSignals(session);
    expect(score).toBeLessThan(0);
  });

  it("rejects when CI failed and changes made", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [{ role: "user", text: "修复这个" }],
      text: "",
      fileChanges: 2,
      toolCalls: 1,
      ciStatus: "failed",
    };

    expect(shouldRejectByExternalSignals(session)).toBe(true);
  });

  it("rejects when user dislikes (emoji)", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [],
      text: "",
      fileChanges: 1,
      toolCalls: 0,
      userEmoji: "👎",
    };

    expect(shouldRejectByExternalSignals(session)).toBe(true);
  });

  it("scores user like as positive", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [],
      text: "",
      fileChanges: 0,
      toolCalls: 0,
      userEmoji: "👍",
    };

    const score = scoreExternalSignals(session);
    expect(score).toBeGreaterThan(0);
  });

  it("handles no external signals gracefully", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [],
      text: "",
      fileChanges: 1,
      toolCalls: 1,
    };

    expect(shouldRejectByExternalSignals(session)).toBe(false);
  });
});
