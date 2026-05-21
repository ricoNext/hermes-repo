import { describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runProjectScan } from "../../src/coldstart/runProjectScan.js";
import { buildScanCaptures } from "../../src/coldstart/buildScanCaptures.js";
import { collectProjectScan } from "../../src/coldstart/collectProjectScan.js";

describe("coldstart scan", () => {
  it("buildScanCaptures from package.json and AGENTS.md", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-scan-"));
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({
        name: "demo-app",
        dependencies: { react: "^18.0.0", express: "^4.0.0" },
        devDependencies: { vitest: "^3.0.0", typescript: "^5.0.0" },
      }),
      "utf8",
    );
    writeFileSync(
      join(dir, "AGENTS.md"),
      "# Rules\n\nUse TypeScript strict mode.\n",
      "utf8",
    );

    const data = collectProjectScan(dir);
    const caps = buildScanCaptures(data);
    expect(caps.length).toBeGreaterThanOrEqual(2);
    expect(caps.every((c) => c.type === "semantic")).toBe(true);
    expect(caps.some((c) => c.tags.includes("stack"))).toBe(true);
  });

  it("runProjectScan writes capture files", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-scan-write-"));
    mkdirSync(join(dir, ".memory", "captures", "semantic"), { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "x", dependencies: { lodash: "4" } }),
      "utf8",
    );

    const result = runProjectScan(dir);
    expect(result.skipped).toBe(false);
    expect(result.capturesWritten).toBeGreaterThan(0);

    const semanticDir = join(dir, ".memory", "captures", "semantic");
    const files = readdirSync(semanticDir).filter((n) => n.endsWith(".md"));
    expect(files.length).toBeGreaterThanOrEqual(1);
    const raw = readFileSync(join(semanticDir, files[0]), "utf8");
    expect(raw).toContain("coldstart");
    expect(raw).toContain("session: coldstart-scan");
  });

  it("returns skipped when no signals", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-scan-empty-"));
    const result = runProjectScan(dir);
    expect(result.skipped).toBe(true);
    expect(result.capturesWritten).toBe(0);
    expect(existsSync(join(dir, ".memory"))).toBe(false);
  });
});
