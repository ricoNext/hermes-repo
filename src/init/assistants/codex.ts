import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CODEX_CONFIG_REL,
  codexConfigPath,
  mergeCodexConfig,
} from "../mergeCodexConfig.js";
import {
  CODEX_HOOKS_REL,
  codexHooksPath,
  mergeCodexHooks,
} from "../mergeCodexHooks.js";
import type { AssistantAdapter, WriteContext } from "./types.js";

export const codexAdapter: AssistantAdapter = {
  id: "codex",
  label: "OpenAI Codex（AGENTS.md + .codex/config.toml）",
  available: true,
  scaffoldPaths: [CODEX_CONFIG_REL, CODEX_HOOKS_REL],
  write(ctx: WriteContext): void {
    mkdirSync(join(ctx.repoRoot, ".codex"), { recursive: true });

    const { content: configContent, action: configAction } =
      mergeCodexConfig(ctx.repoRoot);
    writeFileSync(codexConfigPath(ctx.repoRoot), configContent, "utf8");
    ctx.report.files.push({ path: CODEX_CONFIG_REL, action: configAction });

    const { content: hooksContent, action: hooksAction } =
      mergeCodexHooks(ctx.repoRoot);
    writeFileSync(codexHooksPath(ctx.repoRoot), hooksContent, "utf8");
    ctx.report.files.push({ path: CODEX_HOOKS_REL, action: hooksAction });
  },
};
