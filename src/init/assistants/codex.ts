import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CODEX_CONFIG_REL,
  codexConfigPath,
  mergeCodexConfig,
} from "../mergeCodexConfig.js";
import type { AssistantAdapter, WriteContext } from "./types.js";

export const codexAdapter: AssistantAdapter = {
  id: "codex",
  label: "OpenAI Codex（AGENTS.md + .codex/config.toml）",
  available: true,
  scaffoldPaths: [CODEX_CONFIG_REL],
  write(ctx: WriteContext): void {
    mkdirSync(join(ctx.repoRoot, ".codex"), { recursive: true });
    const { content, action } = mergeCodexConfig(ctx.repoRoot);
    writeFileSync(codexConfigPath(ctx.repoRoot), content, "utf8");
    ctx.report.files.push({ path: CODEX_CONFIG_REL, action });
  },
};
