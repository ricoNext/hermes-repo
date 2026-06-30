import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  encodeCodebuddyProjectDir,
  resolveCodebuddySessionJsonl,
} from "../src/capture/codebuddy/resolveSession.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("encodeCodebuddyProjectDir", () => {
  it("drops leading slash like Cursor not Claude", () => {
    expect(encodeCodebuddyProjectDir("/Users/me/proj")).toBe("Users-me-proj");
  });
});

describe("resolveCodebuddySessionJsonl", () => {
  it("uses HERMES_CODEBUDDY_SESSION override", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-cb-res-"));
    tempDirs.push(dir);
    const jsonl = join(dir, "sess.jsonl");
    writeFileSync(jsonl, '{"role":"user","message":{"content":[{"type":"text","text":"hi"}]}}\n', "utf8");

    const prev = process.env.HERMES_CODEBUDDY_SESSION;
    process.env.HERMES_CODEBUDDY_SESSION = jsonl;
    const resolved = resolveCodebuddySessionJsonl({ repoRoot: dir });
    if (prev === undefined) {
      delete process.env.HERMES_CODEBUDDY_SESSION;
    } else {
      process.env.HERMES_CODEBUDDY_SESSION = prev;
    }
    expect(resolved).toBe(jsonl);
  });

  it("resolves transcript under CODEBUDDY_CONFIG_DIR/projects", () => {
    const repo = mkdtempSync(join(tmpdir(), "hermes-cb-repo-"));
    tempDirs.push(repo);
    const cbHome = mkdtempSync(join(tmpdir(), "hermes-cb-home-"));
    tempDirs.push(cbHome);
    const sessionId = "cb-session-uuid";
    const encoded = encodeCodebuddyProjectDir(repo);
    const jsonl = join(
      cbHome,
      "projects",
      encoded,
      `${sessionId}.jsonl`,
    );
    mkdirSync(join(cbHome, "projects", encoded), { recursive: true });
    writeFileSync(
      jsonl,
      '{"role":"user","message":{"content":[{"type":"text","text":"x"}]}}\n',
      "utf8",
    );

    const prevSession = process.env.HERMES_CODEBUDDY_SESSION;
    const prevHome = process.env.CODEBUDDY_CONFIG_DIR;
    delete process.env.HERMES_CODEBUDDY_SESSION;
    process.env.CODEBUDDY_CONFIG_DIR = cbHome;

    const resolved = resolveCodebuddySessionJsonl({
      repoRoot: repo,
      transcriptPath: jsonl,
    });

    if (prevSession === undefined) {
      delete process.env.HERMES_CODEBUDDY_SESSION;
    } else {
      process.env.HERMES_CODEBUDDY_SESSION = prevSession;
    }
    if (prevHome === undefined) {
      delete process.env.CODEBUDDY_CONFIG_DIR;
    } else {
      process.env.CODEBUDDY_CONFIG_DIR = prevHome;
    }
    expect(resolved).toBe(jsonl);
  });
});
