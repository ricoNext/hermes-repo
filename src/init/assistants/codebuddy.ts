import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CODEBUDDY_SETTINGS_LOCAL_REL,
  codebuddySettingsLocalPath,
  mergeCodebuddyLocalSettings,
} from "../mergeCodebuddySettings.js";
import type { AssistantAdapter, WriteContext } from "./types.js";

export const codebuddyAdapter: AssistantAdapter = {
  id: "codebuddy",
  label: "CodeBuddy（CLI）",
  available: true,
  scaffoldPaths: [CODEBUDDY_SETTINGS_LOCAL_REL],
  write(ctx: WriteContext): void {
    mkdirSync(join(ctx.repoRoot, ".codebuddy"), { recursive: true });
    const { content, action } = mergeCodebuddyLocalSettings(ctx.repoRoot);
    writeFileSync(codebuddySettingsLocalPath(ctx.repoRoot), content, "utf8");
    ctx.report.files.push({ path: CODEBUDDY_SETTINGS_LOCAL_REL, action });
  },
};
