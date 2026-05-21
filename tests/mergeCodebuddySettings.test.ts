import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  codebuddySettingsLocalPath,
  mergeCodebuddyLocalSettings,
} from "../src/init/mergeCodebuddySettings.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("mergeCodebuddyLocalSettings", () => {
  it("creates settings.local.json with Stop and SessionStart", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-cb-settings-"));
    tempDirs.push(dir);
    const { content, action } = mergeCodebuddyLocalSettings(dir);
    expect(action).toBe("created");

    const parsed = JSON.parse(content) as {
      hooks: Record<string, { hooks: { type: string; command: string }[] }[]>;
    };
    expect(parsed.hooks.Stop[0]?.hooks[0]?.type).toBe("command");
    expect(parsed.hooks.Stop[0]?.hooks[0]?.command).toContain("capture");
    expect(parsed.hooks.SessionStart[0]?.hooks[0]?.command).toContain("inject");
    expect(parsed.hooks.Stop[0]?.hooks[0]?.command).toContain(
      "@riconext/hermes-repo",
    );
  });

  it("merges without dropping other hook events", () => {
    const dir = mkdtempSync(join(tmpdir(), "hermes-cb-settings-"));
    tempDirs.push(dir);
    mkdirSync(join(dir, ".codebuddy"), { recursive: true });
    writeFileSync(
      codebuddySettingsLocalPath(dir),
      `${JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "echo audit" }],
            },
          ],
          Stop: [
            {
              hooks: [{ type: "command", command: "echo old-stop" }],
            },
          ],
        },
      })}\n`,
      "utf8",
    );

    const { content, action } = mergeCodebuddyLocalSettings(dir);
    expect(action).toBe("overwritten");

    const parsed = JSON.parse(content) as {
      hooks: Record<string, { hooks: { command: string }[] }[]>;
    };
    expect(parsed.hooks.PreToolUse[0]?.hooks[0]?.command).toBe("echo audit");
    expect(parsed.hooks.Stop[0]?.hooks[0]?.command).toContain("capture");
  });
});
