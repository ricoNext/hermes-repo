import { describe, it, expect } from "vitest";
import {
  getSignalStrength,
  shouldCaptureBySignalStrength,
  computeSignalScore,
  shouldCaptureByScore,
} from "../src/capture/signalStrength.js";
import type { ParsedSession } from "../src/capture/types.js";

describe("signal strength (fix 3)", () => {
  it("detects strong signal", () => {
    const strength = getSignalStrength("改成 X 吧，这样更好");
    expect(strength).toBe("strong");
  });

  it("detects medium signal", () => {
    const strength = getSignalStrength("我们可以考虑用这个方案");
    expect(strength).toBe("medium");
  });

  it("detects weak signal", () => {
    const strength = getSignalStrength("这里为什么要这样做？");
    expect(strength).toBe("weak");
  });

  it("detects no signal", () => {
    const strength = getSignalStrength("hello world");
    expect(strength).toBe("none");
  });

  it("captures strong signal regardless of complexity", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [{ role: "user", text: "改" }],  // 只有 1 条消息
      text: "改成 X",
      fileChanges: 0,
      toolCalls: 0,
    };

    expect(shouldCaptureBySignalStrength(session)).toBe(true);
  });

  it("requires complexity for medium signal", () => {
    const shortSession: ParsedSession = {
      sessionId: "test",
      messages: [{ role: "user", text: "a" }],
      text: "我们可以尝试",
      fileChanges: 0,
      toolCalls: 0,
    };

    expect(shouldCaptureBySignalStrength(shortSession)).toBe(false);

    const complexSession: ParsedSession = {
      ...shortSession,
      messages: Array.from({ length: 5 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        text: `msg${i}`,
      })),
    };

    expect(shouldCaptureBySignalStrength(complexSession)).toBe(true);
  });

  it("requires high complexity for weak signal", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: Array.from({ length: 3 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        text: `msg${i}`,
      })),
      text: "为什么这样？",
      fileChanges: 0,
      toolCalls: 2,  // 不足 8
    };

    expect(shouldCaptureBySignalStrength(session)).toBe(false);

    // 增加复杂度
    const complexSession: ParsedSession = {
      ...session,
      toolCalls: 10,
    };

    expect(shouldCaptureBySignalStrength(complexSession)).toBe(true);
  });

  it("computes signal score correctly", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: Array.from({ length: 8 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        text: `msg${i}`,
      })),
      text: "改成 X",  // 强信号 +30
      fileChanges: 3,
      toolCalls: 5,
    };

    const score = computeSignalScore(session);
    // 强信号 (30) + 6消息*(6-2)*5 (20) + 工具5*2 (10) + 文件3*5 (15) = 75
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("scores session by threshold", () => {
    const lowScoreSession: ParsedSession = {
      sessionId: "test",
      messages: [{ role: "user", text: "a" }],
      text: "hello",  // 无信号
      fileChanges: 0,
      toolCalls: 0,
    };

    expect(shouldCaptureByScore(lowScoreSession)).toBe(false);

    const highScoreSession: ParsedSession = {
      sessionId: "test",
      messages: Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        text: `msg${i}`,
      })),
      text: "改成 X",  // 强信号
      fileChanges: 3,
      toolCalls: 5,
    };

    expect(shouldCaptureByScore(highScoreSession)).toBe(true);
  });
});
