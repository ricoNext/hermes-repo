import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { renderTemplate } from "../templateDir.js";
import { writeIfAllowed } from "../scaffoldWrite.js";
import type { AssistantAdapter, WriteContext } from "./types.js";

export const claudeCodeAdapter: AssistantAdapter = {
  id: "claude-code",
  label: "Claude Code（Stop / SessionStart hooks）",
  available: true,
  scaffoldPaths: [".claude/hooks.json"],
  write(ctx: WriteContext): void {
    const hooksDir = join(ctx.repoRoot, ".claude");
    mkdirSync(hooksDir, { recursive: true });
    const hooksPath = join(hooksDir, "hooks.json");
    writeIfAllowed(
      ctx.report,
      hooksPath,
      ".claude/hooks.json",
      renderTemplate("hooks.json.tpl"),
      ctx.force,
    );
  },
};
