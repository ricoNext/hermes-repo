import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cursorHooksPath,
  mergeCursorHooks,
} from "../src/init/mergeCursorHooks.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("mergeCursorHooks", () => {
  it("creates hooks.json with sessionStart and stop", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-cursor-hooks-"));
    tempDirs.push(dir);
    const { content, action } = mergeCursorHooks(dir);
    expect(action).toBe("created");

    const parsed = JSON.parse(content) as {
      version: number;
      hooks: Record<string, { command: string }[]>;
    };
    expect(parsed.version).toBe(1);
    expect(parsed.hooks.sessionStart[0]?.command).toContain("inject");
    expect(parsed.hooks.stop[0]?.command).toContain("capture");
    expect(parsed.hooks.stop[0]?.command).toContain("@riconext/hermes-repo");
  });

  it("merges without dropping other hook events", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-cursor-hooks-"));
    tempDirs.push(dir);
    mkdirSync(join(dir, ".cursor"), { recursive: true });
    writeFileSync(
      cursorHooksPath(dir),
      `${JSON.stringify({
        version: 1,
        hooks: {
          notification: [{ "command": "echo notify" }],
          sessionStart: [{ "command": "echo old-start" }],
        },
      })}\n`,
      "utf8",
    );

    const { content, action } = mergeCursorHooks(dir);
    expect(action).toBe("overwritten");

    const parsed = JSON.parse(content) as {
      hooks: Record<string, { command: string }[]>;
    };
    expect(parsed.hooks.notification[0]?.command).toBe("echo notify");
    expect(parsed.hooks.sessionStart[0]?.command).toContain("inject");
    expect(parsed.hooks.stop[0]?.command).toContain("capture");
  });

  it("second merge overwrites hermes sessionStart/stop only", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-cursor-hooks-"));
    tempDirs.push(dir);
    mkdirSync(join(dir, ".cursor"), { recursive: true });
    const first = mergeCursorHooks(dir);
    writeFileSync(cursorHooksPath(dir), first.content, "utf8");
    writeFileSync(
      cursorHooksPath(dir),
      first.content.replace("capture", "capture-v2"),
      "utf8",
    );

    const { content } = mergeCursorHooks(dir);
    const parsed = JSON.parse(content) as {
      hooks: { stop: { command: string }[] };
    };
    expect(parsed.hooks.stop[0]?.command).toContain("capture");
    expect(parsed.hooks.stop[0]?.command).not.toContain("capture-v2");
  });
});
