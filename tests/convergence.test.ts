import { describe, it, expect } from "vitest";
import { analyzeMessagePattern, isConvergent } from "../src/capture/convergence.js";
import type { ParsedSession } from "../src/capture/types.js";

describe("convergence analysis", () => {
  it("detects multiple corrections without final approval", () => {
    const session: ParsedSession = {
      sessionId: "test-1",
      messages: [
        { role: "user", text: "这样对吗?" },
        { role: "assistant", text: "我认为应该这样做..." },
        { role: "user", text: "不对，改成X" },
        { role: "assistant", text: "好的，改成X..." },
        { role: "user", text: "还是不对，改成Y" },
        { role: "assistant", text: "改成Y..." },
        { role: "user", text: "嗯嗯，感觉还是有问题" },
      ],
      text: "...",
      fileChanges: 0,
      toolCalls: 2,
    };

    const pattern = analyzeMessagePattern(session);
    expect(pattern.userCorrections).toBeGreaterThan(1);
    expect(pattern.hasFinalApproval).toBe(false);
    expect(pattern.hasUncertainty).toBe(true);
    expect(isConvergent(session)).toBe(false);
  });

  it("accepts corrections that lead to final approval", () => {
    const session: ParsedSession = {
      sessionId: "test-2",
      messages: [
        { role: "user", text: "这样对吗?" },
        { role: "assistant", text: "我认为应该这样做..." },
        { role: "user", text: "不对，改成X" },
        { role: "assistant", text: "好的，改成X..." },
        { role: "user", text: "好的，就这样" },
      ],
      text: "...",
      fileChanges: 1,
      toolCalls: 2,
    };

    const pattern = analyzeMessagePattern(session);
    expect(pattern.hasFinalApproval).toBe(true);
    expect(isConvergent(session)).toBe(true);
  });

  it("accepts single correction", () => {
    const session: ParsedSession = {
      sessionId: "test-3",
      messages: [
        { role: "user", text: "这样对吗?" },
        { role: "assistant", text: "我认为应该这样做..." },
        { role: "user", text: "改成X吧" },
        { role: "assistant", text: "好的，改成X..." },
      ],
      text: "...",
      fileChanges: 1,
      toolCalls: 1,
    };

    const pattern = analyzeMessagePattern(session);
    expect(pattern.userCorrections).toBe(1);
    expect(isConvergent(session)).toBe(true);
  });

  it("accepts session with no corrections", () => {
    const session: ParsedSession = {
      sessionId: "test-4",
      messages: [
        { role: "user", text: "请帮我写个函数" },
        { role: "assistant", text: "好的，这是实现..." },
        { role: "user", text: "谢谢" },
      ],
      text: "...",
      fileChanges: 2,
      toolCalls: 3,
    };

    expect(isConvergent(session)).toBe(true);
  });

  it("detects approval signals correctly", () => {
    const approvalTexts = [
      "好的",
      "可以",
      "就这样",
      "同意",
      "对",
      "yes",
      "ok",
      "looks good",
      "perfect",
      "确认",
    ];

    for (const text of approvalTexts) {
      const session: ParsedSession = {
        sessionId: "test",
        messages: [
          { role: "user", text: "改成X" },
          { role: "assistant", text: "改成X..." },
          { role: "user", text },
        ],
        text: "",
        fileChanges: 0,
        toolCalls: 1,
      };

      const pattern = analyzeMessagePattern(session);
      expect(pattern.hasFinalApproval).toBe(true);
    }
  });

  it("detects uncertainty correctly", () => {
    const uncertaintyTexts = [
      "不明白",
      "还是有问题",
      "不太对",
      "感觉",
      "可能",
      "似乎不对",
    ];

    for (const text of uncertaintyTexts) {
      const session: ParsedSession = {
        sessionId: "test",
        messages: [
          { role: "user", text: "改成X" },
          { role: "assistant", text: "改成X..." },
          { role: "user", text: "不对，改成Y" },
          { role: "assistant", text: "改成Y..." },
          { role: "user", text },
        ],
        text: "",
        fileChanges: 0,
        toolCalls: 1,
      };

      const pattern = analyzeMessagePattern(session);
      expect(pattern.hasUncertainty).toBe(true);
    }
  });

  it("handles empty message list gracefully", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [],
      text: "",
      fileChanges: 0,
      toolCalls: 0,
    };

    const pattern = analyzeMessagePattern(session);
    expect(pattern.lastUserMessage).toBe("");
    expect(pattern.hasFinalApproval).toBe(false);
    expect(isConvergent(session)).toBe(true);
  });

  it("handles all assistant messages gracefully", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [
        { role: "assistant", text: "我可以帮助你" },
        { role: "assistant", text: "这是解决方案" },
      ],
      text: "",
      fileChanges: 0,
      toolCalls: 1,
    };

    const pattern = analyzeMessagePattern(session);
    expect(pattern.lastUserMessage).toBe("");
    expect(isConvergent(session)).toBe(true);
  });
});
