import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CURSOR_HOOKS_REL,
  cursorHooksPath,
  mergeCursorHooks,
} from "../mergeCursorHooks.js";
import type { AssistantAdapter, WriteContext } from "./types.js";

export const cursorAdapter: AssistantAdapter = {
  id: "cursor",
  label: "Cursor（sessionStart / stop hooks）",
  available: true,
  scaffoldPaths: [CURSOR_HOOKS_REL],
  write(ctx: WriteContext): void {
    mkdirSync(join(ctx.repoRoot, ".cursor"), { recursive: true });
    const { content, action } = mergeCursorHooks(ctx.repoRoot);
    writeFileSync(cursorHooksPath(ctx.repoRoot), content, "utf8");
    ctx.report.files.push({ path: CURSOR_HOOKS_REL, action });
  },
};
