import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { readCaptureFile, primaryTag, tagToSlug } from "../consolidate/parseCapture.js";
import { memoryPath } from "../init/paths.js";
import { setFrontmatterScalars } from "../markdown/frontmatter.js";
import { promoteMarkerPath } from "../skills/promoteMarker.js";
import {
  decisionsTemplatePath,
  promoteStagingTopicsDir,
  stagingTopicPath,
} from "./paths.js";
import type {
  PromoteApplyResult,
  PromoteManifest,
} from "./types.js";

export function parseManifestJson(raw: string): PromoteManifest {
  const data = JSON.parse(raw) as PromoteManifest;
  if (!data || !Array.isArray(data.decisions)) {
    throw new Error("manifest must contain decisions array");
  }
  for (const d of data.decisions) {
    if (!d.capturePath || !d.action) {
      throw new Error("each decision needs capturePath and action");
    }
    if (
      d.action !== "approve" &&
      d.action !== "reject" &&
      d.action !== "defer"
    ) {
      throw new Error(`invalid action: ${d.action}`);
    }
    if (d.action === "approve" && d.target && d.target !== "topics") {
      throw new Error(
        "approve with target=skills is not supported in v0.13; use flush for skills",
      );
    }
  }
  return data;
}

export function buildManifestTemplate(
  capturePaths: string[],
  dateIso: string,
): PromoteManifest {
  return {
    generatedAt: dateIso,
    decisions: capturePaths.map((capturePath) => ({
      capturePath,
      action: "defer" as const,
      target: "topics" as const,
    })),
  };
}

function removePromoteMarker(repoRoot: string, capturePath: string): void {
  const marker = promoteMarkerPath(repoRoot, capturePath);
  if (existsSync(marker)) {
    unlinkSync(marker);
  }
}

function annotateReject(
  repoRoot: string,
  capturePath: string,
  note?: string,
): void {
  const abs = join(repoRoot, ".memory", capturePath);
  if (!existsSync(abs)) {
    return;
  }
  try {
    let content = readFileSync(abs, "utf8");
    const fields: Record<string, string> = {
      promote_rejected_at: new Date().toISOString().slice(0, 10),
    };
    if (note?.trim()) {
      fields.promote_note = note.trim().slice(0, 200);
    }
    content = setFrontmatterScalars(content, fields);
    writeFileSync(abs, content, "utf8");
  } catch {
    // skip
  }
}

function mergeTopicFromStaging(
  repoRoot: string,
  slug: string,
  dryRun: boolean,
): string | null {
  const staging = stagingTopicPath(repoRoot, slug);
  if (!existsSync(staging)) {
    return null;
  }
  const draft = readFileSync(staging, "utf8");
  const dest = memoryPath(repoRoot, "topics", `${slug}.md`);
  if (dryRun) {
    return `topics/${slug}.md`;
  }
  mkdirSync(memoryPath(repoRoot, "topics"), { recursive: true });
  writeFileSync(dest, draft.endsWith("\n") ? draft : `${draft}\n`, "utf8");
  return `topics/${slug}.md`;
}

export function applyDecisions(
  repoRoot: string,
  manifest: PromoteManifest,
  opts?: { dryRun?: boolean },
): PromoteApplyResult {
  const dryRun = opts?.dryRun === true;
  const result: PromoteApplyResult = {
    approved: [],
    rejected: [],
    deferred: [],
    topicsWritten: [],
  };

  const slugsToMerge = new Set<string>();

  for (const d of manifest.decisions) {
    const capturePath = d.capturePath.replace(/\\/g, "/");

    if (d.action === "approve") {
      result.approved.push(capturePath);
      if (!dryRun) {
        removePromoteMarker(repoRoot, capturePath);
      }
      const parsed = readCaptureFile(repoRoot, capturePath);
      if (parsed) {
        slugsToMerge.add(tagToSlug(primaryTag(parsed)));
      }
    } else if (d.action === "reject") {
      result.rejected.push(capturePath);
      if (!dryRun) {
        removePromoteMarker(repoRoot, capturePath);
        annotateReject(repoRoot, capturePath, d.note);
      }
    } else {
      result.deferred.push(capturePath);
    }
  }

  if (slugsToMerge.size === 0 && result.approved.length > 0) {
    const stagingDir = promoteStagingTopicsDir(repoRoot);
    if (existsSync(stagingDir)) {
      for (const name of readdirSync(stagingDir)) {
        if (name.endsWith(".md")) {
          slugsToMerge.add(name.replace(/\.md$/, ""));
        }
      }
    }
  }

  for (const slug of slugsToMerge) {
    const rel = mergeTopicFromStaging(repoRoot, slug, dryRun);
    if (rel && !result.topicsWritten.includes(rel)) {
      result.topicsWritten.push(rel);
    }
  }

  return result;
}

export function readManifestFile(manifestPath: string): PromoteManifest {
  const raw = readFileSync(manifestPath, "utf8");
  return parseManifestJson(raw);
}

export function writeManifestTemplate(
  repoRoot: string,
  capturePaths: string[],
): string {
  const dateIso = new Date().toISOString().slice(0, 10);
  const manifest = buildManifestTemplate(capturePaths, dateIso);
  const path = decisionsTemplatePath(repoRoot);
  mkdirSync(memoryPath(repoRoot, "promote"), { recursive: true });
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return path;
}
