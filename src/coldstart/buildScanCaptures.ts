import type { FormattedCapture } from "../capture/formatCapture.js";
import { COLDSTART_BASE_TAGS, COLDSTART_SESSION_ID } from "./constants.js";
import { inferStackTags } from "./collectors/packageJson.js";
import type { ProjectScanData } from "./collectors/types.js";

function semanticCapture(
  tags: string[],
  context: string,
  findings: string,
  impact = "供 AI 在后续任务中参考；细节以仓库现状为准。",
): FormattedCapture {
  const tagSet = new Set([...COLDSTART_BASE_TAGS, ...tags]);
  return {
    type: "semantic",
    sessionId: COLDSTART_SESSION_ID,
    tags: [...tagSet],
    scope: "all",
    bodyMarkdown: `## 上下文

${context}

## 发现

${findings}

## 影响

${impact}`,
  };
}

export function buildScanCaptures(data: ProjectScanData): FormattedCapture[] {
  const captures: FormattedCapture[] = [];

  if (data.packageJson) {
    const allDeps = [
      ...data.packageJson.dependencies,
      ...data.packageJson.devDependencies,
    ];
    const stackTags = inferStackTags(allDeps);
    const nameLine = data.packageJson.name
      ? `项目名称: **${data.packageJson.name}**`
      : "（未命名 package）";
    const depList =
      allDeps.length > 0
        ? allDeps.slice(0, 40).join(", ") +
          (allDeps.length > 40 ? ` …共 ${allDeps.length} 项` : "")
        : "（无 dependencies）";
    captures.push(
      semanticCapture(
        ["stack", ...stackTags],
        "init 项目扫描：从 package.json 提取技术栈。",
        `${nameLine}\n\n主要依赖: ${depList}`,
      ),
    );
  }

  if (data.repoSignals.signals.length > 0) {
    captures.push(
      semanticCapture(
        ["infra"],
        "init 项目扫描：仓库基础设施与工程化文件。",
        data.repoSignals.signals.map((s) => `- ${s}`).join("\n"),
      ),
    );
  }

  if (data.gitLog.lines.length > 0) {
    const sample = data.gitLog.lines.slice(0, 15).map((l) => `- ${l}`).join("\n");
    captures.push(
      semanticCapture(
        ["git", "activity"],
        "init 项目扫描：最近 Git 提交（oneline）。",
        `最近 ${data.gitLog.lines.length} 条提交摘要（展示前 15 条）:\n\n${sample}`,
        "可据此判断近期活跃模块与变更主题。",
      ),
    );
  }

  for (const src of data.existingRules.sources) {
    captures.push(
      semanticCapture(
        ["migrated-rules"],
        `init 项目扫描：迁移自 \`${src.path}\` 的既有约定。`,
        `来源文件: \`${src.path}\`\n\n摘录:\n\n${src.excerpt}`,
        "团队真相源仍以原文件为准；本捕获仅供 MEMORY 注入摘要。",
      ),
    );
  }

  return captures;
}
