import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findRepoRoot } from "../src/config/findRepoRoot.js";
import { loadRepoContext, readConfigAtRepo } from "../src/config/readConfig.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function initRepo(
  dir: string,
  assistants: string[] = ["claude-code"],
  debug?: boolean,
): void {
  mkdirSync(join(dir, ".memory"), { recursive: true });
  const body: Record<string, unknown> = {
    version: 1,
    storage: { backend: "file" },
    assistants,
  };
  if (debug !== undefined) {
    body.debug = debug;
  }
  writeFileSync(
    join(dir, ".memory", "config.json"),
    `${JSON.stringify(body)}\n`,
    "utf8",
  );
}

describe("readConfig", () => {
  it("findRepoRoot walks up from nested cwd", () => {
    const root = mkdtempSync(join(tmpdir(), "hermes-cfg-"));
    tempDirs.push(root);
    initRepo(root);
    const nested = join(root, "packages", "app");
    mkdirSync(nested, { recursive: true });
    expect(findRepoRoot(nested)).toBe(root);
  });

  it("readConfigAtRepo parses assistants", () => {
    const root = mkdtempSync(join(tmpdir(), "hermes-cfg-"));
    tempDirs.push(root);
    initRepo(root);
    const config = readConfigAtRepo(root);
    expect(config?.assistants).toContain("claude-code");
  });

  it("readConfigAtRepo defaults debug to false when missing", () => {
    const root = mkdtempSync(join(tmpdir(), "hermes-cfg-"));
    tempDirs.push(root);
    initRepo(root);
    expect(readConfigAtRepo(root)?.debug).toBe(false);
  });

  it("readConfigAtRepo parses debug true", () => {
    const root = mkdtempSync(join(tmpdir(), "hermes-cfg-"));
    tempDirs.push(root);
    initRepo(root, ["claude-code"], true);
    expect(readConfigAtRepo(root)?.debug).toBe(true);
  });

  it("readConfigAtRepo defaults v2 autoFlush to enabled when missing", () => {
    const root = mkdtempSync(join(tmpdir(), "hermes-cfg-"));
    tempDirs.push(root);
    mkdirSync(join(root, ".memory"), { recursive: true });
    writeFileSync(
      join(root, ".memory", "config.json"),
      `${JSON.stringify({
        version: 2,
        storage: { backend: "file" },
        assistants: ["claude-code"],
        consolidate: {
          autoFlush: {
            minPendingSessions: 2,
          },
        },
      })}\n`,
      "utf8",
    );

    const config = readConfigAtRepo(root);
    expect(config?.consolidate.autoFlush).toMatchObject({
      enabled: true,
      minPendingSessions: 2,
    });
  });

  it("readConfigAtRepo preserves explicit v2 autoFlush disabled", () => {
    const root = mkdtempSync(join(tmpdir(), "hermes-cfg-"));
    tempDirs.push(root);
    mkdirSync(join(root, ".memory"), { recursive: true });
    writeFileSync(
      join(root, ".memory", "config.json"),
      `${JSON.stringify({
        version: 2,
        storage: { backend: "file" },
        assistants: ["claude-code"],
        consolidate: {
          autoFlush: {
            enabled: false,
          },
        },
      })}\n`,
      "utf8",
    );

    expect(readConfigAtRepo(root)?.consolidate.autoFlush.enabled).toBe(false);
  });

  it("loadRepoContext returns null when missing", () => {
    const root = mkdtempSync(join(tmpdir(), "hermes-cfg-"));
    tempDirs.push(root);
    expect(loadRepoContext(root)).toBeNull();
  });
});
