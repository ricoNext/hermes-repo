import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { getAdapter } from "./assistants/registry.js";
import type { AssistantId } from "./assistants/types.js";
import type { InitReport, InitResolvedOptions } from "./types.js";
import { EXAMPLE_TEMPLATE_FILES, memoryPath } from "./paths.js";
import { renderTemplate, resolveTemplatePath } from "./templateDir.js";
import { mergeConfigForInit } from "./mergeConfig.js";
import { mergeAgentsMd } from "./mergeAgentsMd.js";
import { shouldWriteFile, writeIfAllowed } from "./scaffoldWrite.js";
import {
  DEFAULT_LLM_BASE_URL,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_TIMEOUT_MS,
  DEFAULT_LLM_MAX_INPUT_CHARS,
} from "../config/llmConfig.js";
import { DEFAULT_MCP_SERVER_URL } from "../config/mcpConfig.js";

export { shouldWriteFile } from "./scaffoldWrite.js";

/** 生成 v2 config.json 内容 */
export function buildConfigJson(assistants: AssistantId[]): string {
  return `${JSON.stringify(
    {
      version: 2,
      storage: {
        backend: "file",
        mcp: {
          enabled: false,
          serverUrl: DEFAULT_MCP_SERVER_URL,
        },
      },
      assistants,
      debug: false,
      llm: {
        enabled: false,
        provider: "openai",
        baseUrl: DEFAULT_LLM_BASE_URL,
        model: DEFAULT_LLM_MODEL,
        apiKey: "",
        timeoutMs: DEFAULT_LLM_TIMEOUT_MS,
        maxInputChars: DEFAULT_LLM_MAX_INPUT_CHARS,
      },
      consolidate: {
        autoArchiveDays: 30,
        autoFlush: {
          enabled: true,
          minPendingSessions: 3,
          minIntervalMinutes: 30,
          maxPendingChars: 20_000,
        },
      },
    },
    null,
    2,
  )}\n`;
}

function writeConfigJson(
  report: InitReport,
  repoRoot: string,
  assistants: AssistantId[],
  llmOverride?: InitResolvedOptions["llm"],
  mcpOverride?: InitResolvedOptions["mcp"],
): void {
  const mcpConfig = mcpOverride
    ? {
        enabled: Boolean(mcpOverride.enabled && mcpOverride.projectId),
        serverUrl: mcpOverride.serverUrl,
        ...(mcpOverride.projectId ? { projectId: mcpOverride.projectId } : {}),
      }
    : undefined;

  const { content, action } = mergeConfigForInit(
    repoRoot,
    assistants,
    llmOverride,
    mcpConfig,
  );
  const absolutePath = memoryPath(repoRoot, "config.json");
  writeFileSync(absolutePath, content, "utf8");
  report.files.push({ path: ".memory/config.json", action });
}

function copyTemplateIfAllowed(
  report: InitReport,
  templateName: string,
  destAbsolute: string,
  relativePath: string,
  force: boolean,
): void {
  const { write, action } = shouldWriteFile(destAbsolute, force);
  if (!write) {
    report.files.push({ path: relativePath, action });
    return;
  }
  copyFileSync(resolveTemplatePath(templateName), destAbsolute);
  report.files.push({ path: relativePath, action });
}

export function writeScaffoldFiles(
  repoRoot: string,
  opts: InitResolvedOptions,
  report: InitReport,
): void {
  const { force, includeExampleTemplates, assistants } = opts;

  writeConfigJson(report, repoRoot, assistants, opts.llm, opts.mcp);

  // MEMORY.md — v2 导航模板
  writeIfAllowed(
    report,
    memoryPath(repoRoot, "MEMORY.md"),
    ".memory/MEMORY.md",
    renderTemplate("MEMORY.md.tpl"),
    force,
  );

  // consolidate-state.json — 初始空状态
  writeIfAllowed(
    report,
    memoryPath(repoRoot, "consolidate-state.json"),
    ".memory/consolidate-state.json",
    `${JSON.stringify(
      {
        version: 1,
        lastConsolidatedAt: null,
        stats: {
          totalCapturesProcessed: 0,
          domains: [],
          knowledgeFilesCreated: 0,
        },
        processedSessions: {},
      },
      null,
      2,
    )}\n`,
    force,
  );

  // v2: 不再生成 sessions/index.json 和 team/steward-log.md

  report.files.push({
    path: "AGENTS.md",
    action: mergeAgentsMd(repoRoot, force),
  });

  for (const id of assistants) {
    getAdapter(id).write({ repoRoot, force, report });
  }

  if (includeExampleTemplates && EXAMPLE_TEMPLATE_FILES.length > 0) {
    // v2: templates/ 目录不在 ensureMemoryTree 中，按需创建
    const templatesDir = memoryPath(repoRoot, "templates");
    mkdirSync(templatesDir, { recursive: true });
    for (const name of EXAMPLE_TEMPLATE_FILES) {
      const dest = memoryPath(repoRoot, "templates", name);
      copyTemplateIfAllowed(
        report,
        name,
        dest,
        `.memory/templates/${name}`,
        force,
      );
    }
  }
}
