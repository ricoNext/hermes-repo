import { describe, it, expect } from "vitest";
import {
  detectDomains,
  hasDomainSpecificKeyword,
  getDomainSignalWeight,
  computeDomainAwareScore,
} from "../src/capture/domainDetection.js";
import type { ParsedSession } from "../src/capture/types.js";

describe("domain detection (fix 4)", () => {
  it("detects systems programming domain", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [{ role: "user", text: "segfault 错误" }],
      text: "这里有 memory leak",
      fileChanges: 0,
      toolCalls: 0,
    };

    const domains = detectDomains(session);
    const systemsDomain = domains.find((d) => d.name === "systems");
    expect(systemsDomain).toBeDefined();
  });

  it("detects devops domain", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [{ role: "user", text: "deployment" }],
      text: "Kubernetes deployment 失败了",
      fileChanges: 0,
      toolCalls: 0,
    };

    const domains = detectDomains(session);
    const devopsDomain = domains.find((d) => d.name === "devops");
    expect(devopsDomain).toBeDefined();
  });

  it("detects security domain", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [{ role: "user", text: "encryption" }],
      text: "需要加强认证和授权",
      fileChanges: 0,
      toolCalls: 0,
    };

    const domains = detectDomains(session);
    const securityDomain = domains.find((d) => d.name === "security");
    expect(securityDomain).toBeDefined();
  });

  it("detects data science domain", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [{ role: "user", text: "过拟合" }],
      text: "TensorFlow 模型训练",
      fileChanges: 0,
      toolCalls: 0,
    };

    const domains = detectDomains(session);
    const dsDomain = domains.find((d) => d.name === "datascience");
    expect(dsDomain).toBeDefined();
  });

  it("checks domain-specific keywords", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [],
      text: "segfault caused by buffer overflow",
      fileChanges: 0,
      toolCalls: 0,
    };

    const domains = detectDomains(session);
    const systemsDomain = domains.find((d) => d.name === "systems");
    expect(systemsDomain).toBeDefined();
    expect(hasDomainSpecificKeyword(session, systemsDomain!)).toBe(true);
  });

  it("applies domain weight multiplier", () => {
    const regularSession: ParsedSession = {
      sessionId: "test",
      messages: [],
      text: "normal code changes",
      fileChanges: 1,
      toolCalls: 1,
    };

    const regularWeight = getDomainSignalWeight(regularSession);
    expect(regularWeight).toBe(1.0);

    const securitySession: ParsedSession = {
      sessionId: "test",
      messages: [],
      text: "CVE vulnerability fix",  // 安全领域
      fileChanges: 1,
      toolCalls: 1,
    };

    const securityWeight = getDomainSignalWeight(securitySession);
    expect(securityWeight).toBeGreaterThan(1.0);  // 安全领域权重更高
  });

  it("computes domain-aware score", () => {
    const baseScore = 50;

    const normalScore = computeDomainAwareScore(
      baseScore,
      {
        sessionId: "test",
        messages: [],
        text: "normal",
        fileChanges: 0,
        toolCalls: 0,
      }
    );
    expect(normalScore).toBe(50);  // 无领域匹配，不变

    const securityScore = computeDomainAwareScore(
      baseScore,
      {
        sessionId: "test",
        messages: [],
        text: "security authentication fix",  // 安全领域
        fileChanges: 0,
        toolCalls: 0,
      }
    );
    expect(securityScore).toBeGreaterThan(baseScore);  // 权重提升
  });

  it("handles multiple domain detection", () => {
    const session: ParsedSession = {
      sessionId: "test",
      messages: [],
      text: "使用 Kubernetes 部署并添加加密",  // 既有 devops 又有 security
      fileChanges: 0,
      toolCalls: 0,
    };

    const domains = detectDomains(session);
    expect(domains.length).toBeGreaterThanOrEqual(2);
    expect(domains.some((d) => d.name === "devops")).toBe(true);
    expect(domains.some((d) => d.name === "security")).toBe(true);
  });
});
