import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readLlmConfigAtRepo } from "../config/readLlmConfig.js";
import { loadRepoContext } from "../config/readConfig.js";
import { memoryPath } from "../init/paths.js";
import {
  analyzeCandidates,
  buildMergedStagingDrafts,
} from "./analyzeCandidate.js";
import { applyDecisions, readManifestFile, writeManifestTemplate } from "./applyDecisions.js";
import { buildPrBody } from "./buildPrBody.js";
import {
  listPromoteCandidates,
  normalizeCapturePath,
} from "./listPromoteCandidates.js";
import {
  defaultPrBodyPath,
  promoteDir,
  promoteStagingTopicsDir,
  stagingTopicPath,
} from "./paths.js";
import type { PromoteApplyResult, PromoteCandidateAnalysis } from "./types.js";

export interface RunPromoteOptions {
  cwd?: string;
  mode: "preview" | "pr" | "apply";
  manifestPath?: string;
  outPath?: string;
  dryRun?: boolean;
  captureFilters?: string[];
}

export interface RunPromotePreviewResult {
  analyses: PromoteCandidateAnalysis[];
}

export interface RunPromotePrResult {
  analyses: PromoteCandidateAnalysis[];
  prBodyPath: string;
  stagingTopicPaths: string[];
  manifestTemplatePath: string;
}

function ensurePromoteDirs(repoRoot: string): void {
  mkdirSync(promoteDir(repoRoot), { recursive: true });
  mkdirSync(promoteStagingTopicsDir(repoRoot), { recursive: true });
}

function formatPreviewTable(analyses: PromoteCandidateAnalysis[]): string {
  const lines = [
    "path | type | tag | suggest | conflict",
    "-----|------|-----|---------|----------",
  ];
  for (const a of analyses) {
    const conflict = a.conflict.hasConflict ? "yes" : "no";
    lines.push(
      `${a.capture.path} | ${a.capture.type} | ${a.primaryTag} | ${a.suggestedAction} | ${conflict}`,
    );
  }
  return lines.join("\n");
}

export async function runPromote(
  opts: RunPromoteOptions,
): Promise<
  | RunPromotePreviewResult
  | RunPromotePrResult
  | PromoteApplyResult
  | { empty: true }
> {
  const ctx = loadRepoContext(opts.cwd);
  if (!ctx) {
    throw new Error("not a hermes-repo project (run init first)");
  }
  const repoRoot = ctx.repoRoot;

  if (opts.mode === "apply") {
    if (!opts.manifestPath) {
      throw new Error("--apply requires --manifest <path>");
    }
    const manifest = readManifestFile(resolve(opts.manifestPath));
    return applyDecisions(repoRoot, manifest, { dryRun: opts.dryRun });
  }

  const filters = opts.captureFilters?.map(normalizeCapturePath);
  const candidates = listPromoteCandidates(repoRoot, filters);

  if (candidates.length === 0) {
    return { empty: true };
  }

  const llm = readLlmConfigAtRepo(repoRoot);
  const analyses = await analyzeCandidates(repoRoot, candidates, llm);

  if (opts.mode === "preview") {
    return { analyses };
  }

  ensurePromoteDirs(repoRoot);
  const dateIso = new Date().toISOString().slice(0, 10);
  const mergedDrafts = await buildMergedStagingDrafts(repoRoot, analyses, llm);
  const stagingTopicPaths: string[] = [];

  for (const [slug, body] of mergedDrafts) {
    const path = stagingTopicPath(repoRoot, slug);
    writeFileSync(path, body, "utf8");
    stagingTopicPaths.push(
      `.memory/promote/staging/topics/${slug}.md`,
    );
  }

  const prBody = buildPrBody(repoRoot, analyses);
  const prBodyPath = opts.outPath
    ? resolve(opts.outPath)
    : defaultPrBodyPath(repoRoot, dateIso);
  mkdirSync(memoryPath(repoRoot, "promote"), { recursive: true });
  writeFileSync(prBodyPath, prBody, "utf8");

  const manifestTemplatePath = writeManifestTemplate(
    repoRoot,
    candidates.map((c) => c.path),
  );

  return {
    analyses,
    prBodyPath,
    stagingTopicPaths,
    manifestTemplatePath,
  };
}

export function printPreviewReport(analyses: PromoteCandidateAnalysis[]): void {
  console.error(formatPreviewTable(analyses));
  for (const a of analyses) {
    console.error(`\n# ${a.capture.path}\n${a.note}`);
  }
}

export function printPrReport(result: RunPromotePrResult): void {
  const approve = result.analyses.filter((a) => a.suggestedAction === "approve")
    .length;
  const conflicts = result.analyses.filter((a) => a.conflict.hasConflict).length;
  console.error(
    `hermes-repo promote: ${result.analyses.length} candidate(s), ${approve} suggested approve, ${conflicts} conflict(s)`,
  );
  console.error(`PR body: ${result.prBodyPath}`);
  console.error(`Manifest template: ${result.manifestTemplatePath}`);
  for (const p of result.stagingTopicPaths) {
    console.error(`Staging: ${p}`);
  }
  console.error(
    "Next: review PR body → copy decisions.template.json to decisions.json → git commit topics/ → promote --apply --manifest decisions.json → flush",
  );
}

export function printApplyReport(result: PromoteApplyResult): void {
  console.error(
    `hermes-repo promote apply: approved ${result.approved.length}, rejected ${result.rejected.length}, deferred ${result.deferred.length}`,
  );
  if (result.topicsWritten.length > 0) {
    console.error(`Topics written: ${result.topicsWritten.join(", ")}`);
  }
  console.error("Run `hermes-repo flush` to refresh MEMORY.md");
}

export function memoryExists(repoRoot: string): boolean {
  return existsSync(memoryPath(repoRoot, "config.json"));
}
