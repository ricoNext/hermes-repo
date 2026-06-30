import { describe, expect, it } from "vitest";
import { setFrontmatterScalar, setFrontmatterScalars } from "../src/markdown/frontmatter.js";

const SAMPLE = `---
type: semantic
date: 2026-05-20
---

## 发现

hello
`;

describe("frontmatter", () => {
  it("sets scalar fields", () => {
    const out = setFrontmatterScalars(SAMPLE, {
      use_count: 2,
      last_used: "2026-05-21",
    });
    expect(out).toContain("use_count: 2");
    expect(out).toContain("last_used: 2026-05-21");
    expect(out).toContain("## 发现");
  });

  it("replaces existing scalar", () => {
    const withCount = setFrontmatterScalar(SAMPLE, "use_count", 1);
    const out = setFrontmatterScalar(withCount, "use_count", 3);
    expect(out).toMatch(/use_count: 3/);
    expect(out).not.toMatch(/use_count: 1/);
  });
});
