import { collectExistingRules } from "./collectors/existingRules.js";
import { collectGitLog } from "./collectors/gitLog.js";
import { collectPackageJson } from "./collectors/packageJson.js";
import { collectRepoSignals } from "./collectors/repoSignals.js";
import type { ProjectScanData } from "./collectors/types.js";

export function collectProjectScan(repoRoot: string): ProjectScanData {
  const warnings: string[] = [];
  const packageJson = collectPackageJson(repoRoot);
  const repoSignals = collectRepoSignals(repoRoot);
  const gitLog = collectGitLog(repoRoot);
  const existingRules = collectExistingRules(repoRoot);

  if (!packageJson) {
    warnings.push("未找到 package.json，技术栈扫描信息有限");
  }
  if (gitLog.lines.length === 0) {
    warnings.push("无法读取 git log（非 Git 仓库或无提交）");
  }
  if (
    !packageJson &&
    repoSignals.signals.length === 0 &&
    gitLog.lines.length === 0 &&
    existingRules.sources.length === 0
  ) {
    warnings.push("项目扫描未发现可用信号，将跳过生成记忆");
  }

  return {
    packageJson,
    repoSignals,
    gitLog,
    existingRules,
    warnings,
  };
}
