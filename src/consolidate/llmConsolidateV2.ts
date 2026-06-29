import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { memoryPath } from "../init/paths.js";
import type { LlmConfigV2 } from "../config/types.js";
import { debugLog, debugLogBlock } from "../config/debugLog.js";
import type { ScannedSession } from "./sessionScanner.js";

// ─── Types ────────────────────────────────────

export interface ExistingKnowledge {
  path: string;
  title: string;
  type: "rule" | "domain-knowledge" | "workflow" | "decision" | "incident";
  domain: string | null;
  status: string;
  summary: string;
}

export interface LlmConsolidateInput {
  pendingSessions: PendingSessionInput[];
  existingKnowledge: ExistingKnowledge[];
  currentMemoryMd: string | null;
}

export interface PendingSessionInput {
  sessionId: string;
  status: "pending" | "stale";
  content: string; // 完整的 markdown（含 frontmatter + body）
  captureCount: number;
  createdAt: string;
}

export interface KnowledgeFileOutput {
  targetPath: string;
  action: "create" | "update";
  frontmatter: Record<string, unknown>;
  body: string;
}

export interface LlmConsolidateResult {
  knowledgeFiles: KnowledgeFileOutput[];
  memoryMd: string;
  skippedSessions: Array<{ sessionId: string; reason: string }>;
}

// ─── System Prompt ────────────────────────────

const CONSOLIDATE_SYSTEM_PROMPT = `你是一个项目知识整理专家。你的任务是从 AI 编程助手的对话记录中提炼出结构化的知识库。

## 工作流程

### 第一步：分析理解
通读所有待处理的 session 记录，理解：
- 讨论了哪些业务领域（模块、子系统、功能）
- 产生了哪类知识（规范、事实、流程、决策、踩坑）
- 哪些内容有长期保留价值，哪些是临时噪音

### 第二步：域识别与匹配
为每条有价值的内容确定所属业务域：
- 查看 existingKnowledge 中已有的域列表
- 优先复用已有域，只有确实无法匹配时才新建域
- 无法归类的放入 general 域
- 域名用 kebab-case，简洁明了（如 quoted, inventory, payment）
- 不要创建过于细粒度的域（如不要按文件名建域）

### 第三步：分类判定

| 类型 | 判定条件 | 写入目录 |
|------|---------|---------|
| rule | 编码规范、约定、禁令 | rules/{name}.md |
| domain-knowledge | 业务域的事实、概念、数据模型 | domains/{domain}/{name}.md |
| workflow | 可复用的操作步骤、流程 | workflows/{name}.md |
| decision | 架构选型、方案选择及原因 | decisions/{date}-{slug}.md |
| incident | 踩坑记录、问题根因、修复方式 | incidents/{date}-{slug}.md |

分类优先级：
1. 如果是可执行的步骤流程 → workflow
2. 如果是"为什么选了X而不是Y" → decision
3. 如果是"遇到了X问题，原因是Y，修法是Z" → incident
4. 如果是编码规范、团队约定 → rule
5. 其余 → domain-knowledge（默认）

### 第四步：内容提炼
对归类后的内容进行提炼：

提炼原则：
1. 去除口语化表达、重复讨论、中间错误结论
2. 保留最终确定的结论和关键决策过程
3. 用结构化的 markdown 组织（标题、列表、表格、代码块）
4. 区分"事实"和"推断"，对不确定的内容标注 confidence: low
5. 保留足够的上下文让未来阅读者理解背景

如果是更新已有文件（action=update）：
- 对比新旧内容，保留仍有效的部分
- 更新被修正的部分（标注更新日期）
- 追加全新内容
- 移除已被完全替代的旧段落

### 第五步：生成导航 (MEMORY.md)
重新生成导航页面：

组织原则：
1. rules 放最前（必读），每项一行：[路径](链接) — 摘要
2. domains 按域分组表格展示
3. workflows 简短列出
4. decisions/incidents 只显示计数和最近几条
5. 每个摘要控制在 20 字以内
6. 整体保持紧凑（目标 < 100 行），AI 注入时不会太长
7. 保留用户的自定义编辑标记 <!-- user-edit-start --> ... <!-- user-edit-end -->

## 输出要求
- 输出严格 JSON 格式
- knowledgeFiles 数组包含所有需要创建/更新的文件
  - 每项必须包含 targetPath、action、frontmatter、body
  - targetPath 是相对 .memory/ 的路径，例如 "domains/canvas/canvas-interaction.md"
  - 不要使用 path、filePath、filename 等字段代替 targetPath
  - frontmatter 必须是 JSON 对象，不要输出 YAML 字符串
  - body 是不包含 frontmatter 的 markdown 正文
- memoryMd 是完整 MEMORY.md 内容
- 无价值的 session 在 skippedSessions 中说明原因（而非生成空内容）`;

// ─── 扫描已有知识文件 ───────────────────────

/**
 * 扫描 rules/, domains/, workflows/, decisions/, incidents/
 * 返回已有知识文件的摘要列表。
 */
export function scanExistingKnowledge(repoRoot: string): ExistingKnowledge[] {
  const results: ExistingKnowledge[] = [];

  // 定义各类型目录和对应的 type
  const typeDirs: Array<{ dir: string; type: ExistingKnowledge["type"] }> = [
    { dir: "rules", type: "rule" },
    { dir: "workflows", type: "workflow" },
    { dir: "decisions", type: "decision" },
    { dir: "incidents", type: "incident" },
  ];

  for (const { dir, type } of typeDirs) {
    const absDir = memoryPath(repoRoot, dir);
    scanMarkdownDirectory(absDir, dir, type, null, results);
  }

  // domains 下可能有多个子目录
  const domainsDir = memoryPath(repoRoot, "domains");
  try {
    const subdirs = readdirSync(domainsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const domain of subdirs) {
      const domainAbsDir = join(domainsDir, domain);
      scanMarkdownDirectory(
        domainAbsDir,
        `domains/${domain}`,
        "domain-knowledge",
        domain,
        results,
      );
    }
  } catch {
    // domains 目录不存在
  }

  return results;
}

function scanMarkdownDirectory(
  absoluteDir: string,
  relativePrefix: string,
  type: ExistingKnowledge["type"],
  domain: string | null,
  results: ExistingKnowledge[],
): void {
  let files: string[];
  try {
    files = readdirSync(absoluteDir).filter((f) => f.endsWith(".md"));
  } catch {
    return;
  }

  for (const file of files) {
    try {
      const content = readFileSync(join(absoluteDir, file), "utf8");
      // 解析 frontmatter 提取 title
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      let title = file.replace(/\.md$/, "");
      if (fmMatch) {
        const titleMatch = fmMatch[1].match(/^title:\s*(.+)$/m);
        if (titleMatch) title = titleMatch[1].replace(/^["']|["']$/g, "");
      }

      // 取前 100 字作为摘要
      const bodyStart = content.indexOf("---", 4);
      const body =
        bodyStart >= 0 ? content.slice(bodyStart + 3).trim() : content;
      const summary = body.slice(0, 150).replace(/\n/g, " ").trim();

      results.push({
        path: `${relativePrefix}/${file}`,
        title,
        type,
        domain,
        status: "active",
        summary,
      });
    } catch {
      // 跳过无法读取的文件
    }
  }
}

// ─── 构建 LLM Input ──────────────────────────

export function buildLlmConsolidateInput(
  repoRoot: string,
  sessions: ScannedSession[],
): LlmConsolidateInput {
  const pendingSessions: PendingSessionInput[] = sessions.map((s) => ({
    sessionId: s.sessionId,
    status: s.frontmatter.status as "pending" | "stale",
    content: readFileSync(s.absolutePath, "utf8"),
    captureCount: s.frontmatter.captureCount,
    createdAt: s.frontmatter.createdAt,
  }));

  const existingKnowledge = scanExistingKnowledge(repoRoot);

  // 读取当前 MEMORY.md
  const memoryPathAbs = memoryPath(repoRoot, "MEMORY.md");
  let currentMemoryMd: string | null = null;
  try {
    currentMemoryMd = readFileSync(memoryPathAbs, "utf8");
  } catch {
    // 不存在则传 null
  }

  return {
    pendingSessions,
    existingKnowledge,
    currentMemoryMd,
  };
}

// ─── 调用 LLM ────────────────────────────────

/**
 * 单次 LLM 调用完成完整 consolidate。
 *
 * @throws 当 LLM 未配置或调用失败时抛出错误
 */
export async function callLlmConsolidate(
  input: LlmConsolidateInput,
  llmConfig: LlmConfigV2,
  debug = false,
): Promise<LlmConsolidateResult> {
  if (!llmConfig.enabled) {
    throw new Error(
      "LLM 未启用：请在 config.json 中设置 llm.enabled = true",
    );
  }

  if (!llmConfig.apiKey.trim() || !llmConfig.baseUrl.trim() || !llmConfig.model.trim()) {
    throw new Error(
      "LLM 未配置：请在 config.json 中设置 llm.apiKey、llm.baseUrl 和 llm.model",
    );
  }

  const url = `${llmConfig.baseUrl.replace(/\/$/, "")}/chat/completions`;

  // 构造 user message — 将 input 序列化为 JSON
  const userContent = formatUserMessage(input);
  debugLog(
    debug,
    "llm",
    `request: provider=${llmConfig.provider}, model=${llmConfig.model}, baseUrl=${llmConfig.baseUrl}, pendingSessions=${input.pendingSessions.length}, existingKnowledge=${input.existingKnowledge.length}, currentMemoryChars=${input.currentMemoryMd?.length ?? 0}`,
  );
  debugLogBlock(debug, "llm", "system prompt", CONSOLIDATE_SYSTEM_PROMPT);
  debugLogBlock(debug, "llm", "user input", userContent);

  const requestBody = {
    model: llmConfig.model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: CONSOLIDATE_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
  };
  debugLogBlock(debug, "llm", "request body", JSON.stringify(requestBody, null, 2));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000); // 2 分钟超时

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llmConfig.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    debugLog(debug, "llm", `response status: ${res.status} ${res.statusText}`);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      debugLogBlock(debug, "llm", "error response body", errBody);
      throw new Error(
        `LLM API 错误 (${res.status}): ${errBody.slice(0, 300)}`,
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    debugLogBlock(debug, "llm", "response json", JSON.stringify(data, null, 2));
    const rawContent = data.choices?.[0]?.message?.content;

    if (!rawContent) {
      throw new Error("LLM 返回内容为空");
    }
    debugLogBlock(debug, "llm", "raw message content", rawContent);

    // 解析 JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new Error("LLM 返回内容不是合法 JSON");
    }
    debugLogBlock(debug, "llm", "parsed content", JSON.stringify(parsed, null, 2));

    const normalized = validateAndNormalizeLlmResult(parsed);
    debugLog(
      debug,
      "llm",
      `normalized: knowledgeFiles=${normalized.knowledgeFiles.length}, memoryChars=${normalized.memoryMd.length}, skippedSessions=${normalized.skippedSessions.length}`,
    );
    debugLogBlock(
      debug,
      "llm",
      "normalized knowledgeFiles",
      JSON.stringify(normalized.knowledgeFiles, null, 2),
    );
    debugLogBlock(debug, "llm", "normalized memoryMd", normalized.memoryMd);
    debugLogBlock(
      debug,
      "llm",
      "normalized skippedSessions",
      JSON.stringify(normalized.skippedSessions, null, 2),
    );

    return normalized;
  } catch (err) {
    debugLog(
      debug,
      "llm",
      `error: ${err instanceof Error ? err.message : String(err)}`,
    );
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── 格式化 user message ─────────────────────

function formatUserMessage(input: LlmConsolidateInput): string {
  // 截断 session 内容避免过长（保留前 8000 字符）
  const maxSessionChars = 8000;
  const truncatedSessions = input.pendingSessions.map((s) => ({
    ...s,
    content:
      s.content.length > maxSessionChars
        ? s.content.slice(0, maxSessionChars) +
          `\n\n... [截断，原始长度: ${s.content.length} 字符]`
        : s.content,
  }));

  return JSON.stringify(
    {
      pendingSessions: truncatedSessions,
      existingKnowledge: input.existingKnowledge.map((k) => ({
        path: k.path,
        title: k.title,
        type: k.type,
        domain: k.domain,
        status: k.status,
        summary: k.summary,
      })),
      currentMemoryMd: input.currentMemoryMd ?? "",
    },
    null,
    2,
  );
}

// ─── 验证 & 标准化 LLM 返回结果 ───────────────

function validateAndNormalizeLlmResult(
  raw: unknown,
): LlmConsolidateResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("LLM 返回格式错误：期望 JSON 对象");
  }

  const obj = raw as Record<string, unknown>;

  const knowledgeFiles: KnowledgeFileOutput[] = Array.isArray(obj.knowledgeFiles)
    ? (obj.knowledgeFiles as unknown[]).map(normalizeKnowledgeFile).filter(Boolean) as KnowledgeFileOutput[]
    : [];

  const memoryMd =
    typeof obj.memoryMd === "string"
      ? obj.memoryMd
      : "# 项目知识库\n\n> 待 consolidate";

  const skippedSessions: Array<{ sessionId: string; reason: string }> = Array.isArray(
    obj.skippedSessions,
  )
    ? (obj.skippedSessions as unknown[]).filter(isSkippedEntry)
    : [];

  return { knowledgeFiles, memoryMd, skippedSessions };
}

function normalizeKnowledgeFile(raw: unknown): KnowledgeFileOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const targetPath =
    typeof obj.targetPath === "string"
      ? obj.targetPath
      : typeof obj.path === "string"
        ? obj.path
        : null;

  if (
    !targetPath ||
    !["create", "update"].includes(obj.action as string) ||
    typeof obj.body !== "string"
  ) {
    return null;
  }

  return {
    targetPath,
    action: obj.action as "create" | "update",
    frontmatter: normalizeFrontmatter(obj.frontmatter),
    body: obj.body as string,
  };
}

function normalizeFrontmatter(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  if (typeof raw !== "string") {
    return {};
  }

  const text = raw.trim();
  const yaml = text.startsWith("---")
    ? text.replace(/^---\r?\n?/, "").replace(/\r?\n?---$/, "")
    : text;
  const frontmatter: Record<string, unknown> = {};

  for (const line of yaml.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf(":");
    if (separator <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    frontmatter[key] = parseFrontmatterValue(value);
  }

  return frontmatter;
}

function parseFrontmatterValue(value: string): unknown {
  const unquoted = value.replace(/^["']|["']$/g, "");
  if (unquoted.startsWith("[") && unquoted.endsWith("]")) {
    return unquoted
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  if (unquoted === "true") return true;
  if (unquoted === "false") return false;
  return unquoted;
}

function isSkippedEntry(raw: unknown): raw is { sessionId: string; reason: string } {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj.sessionId === "string" && typeof obj.reason === "string"
  );
}
