import { describe, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shouldRunConsolidate } from "../src/consolidate/shouldRunConsolidate.js";

describe("shouldRunConsolidate", () => {
  it("v2: auto-scheduling disabled — returns false by default", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-src-"));
    mkdirSync(join(dir, ".memory", "captures"), { recursive: true });
    const result = shouldRunConsolidate({ repoRoot: dir, force: false });
    expect(result.shouldRun).toBe(false);
  });

  it("manual flag triggers consolidation", () => {
    const result = shouldRunConsolidate({
      repoRoot: "/tmp/fake",
      manual: true,
    });
    expect(result.shouldRun).toBe(true);
    expect(result.reason).toBe("manual");
  });

  it("force flag triggers consolidation", () => {
    const result = shouldRunConsolidate({ repoRoot: "/tmp/fake", force: true });
    expect(result.shouldRun).toBe(true);
    expect(result.reason).toBe("force");
  });

  it("returns hasConflict false and zero count when not forced", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-src-"));
    mkdirSync(join(dir, ".memory"), { recursive: true });
    const result = shouldRunConsolidate({ repoRoot: dir });
    expect(result.hasConflict).toBe(false);
    expect(result.newCaptureCount).toBe(0);
  });
});
