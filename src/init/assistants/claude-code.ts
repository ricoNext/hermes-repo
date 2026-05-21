import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLAUDE_SETTINGS_LOCAL_REL,
  claudeSettingsLocalPath,
  mergeClaudeLocalSettings,
} from "../mergeClaudeSettings.js";
import type { AssistantAdapter, WriteContext } from "./types.js";

export const claudeCodeAdapter: AssistantAdapter = {
  id: "claude-code",
  label: "Claude Code（Stop / SessionStart hooks）",
  available: true,
  scaffoldPaths: [CLAUDE_SETTINGS_LOCAL_REL],
  write(ctx: WriteContext): void {
    mkdirSync(join(ctx.repoRoot, ".claude"), { recursive: true });
    const { content, action } = mergeClaudeLocalSettings(ctx.repoRoot);
    writeFileSync(claudeSettingsLocalPath(ctx.repoRoot), content, "utf8");
    ctx.report.files.push({ path: CLAUDE_SETTINGS_LOCAL_REL, action });
  },
};
