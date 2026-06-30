import { describe, expect, it } from "vitest";
import {
  parseCaptureMarkdown,
  primaryTag,
  tagToSlug,
} from "../src/consolidate/parseCapture.js";

const SAMPLE = `---
type: semantic
date: 2026-05-20
session: sess-1
tags: [auth, token, security]
scope: all
confidence: pending
llmUpgradedAt: 2026-05-20T10:00:00.000Z
---

## 上下文

working on auth

## 发现

Use httpOnly cookie for tokens

## 影响

Better XSS protection
`;

describe("parseCapture", () => {
  it("parses frontmatter and findings", () => {
    const p = parseCaptureMarkdown(
      SAMPLE,
      "captures/semantic/capture-2026-05-20-001.md",
      "/tmp/capture.md",
    );
    expect(p).not.toBeNull();
    expect(p!.type).toBe("semantic");
    expect(p!.tags).toContain("auth");
    expect(p!.findings).toContain("httpOnly");
    expect(p!.llmUpgradedAt).toBeDefined();
  });

  it("primaryTag skips auto-capture", () => {
    const p = parseCaptureMarkdown(
      SAMPLE,
      "captures/semantic/capture-2026-05-20-001.md",
      "/tmp/capture.md",
    )!;
    expect(primaryTag(p)).toBe("auth");
  });

  it("tagToSlug handles unicode", () => {
    expect(tagToSlug("API 约定")).toMatch(/api/);
  });
});
