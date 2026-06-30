import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readTemplate } from "./templateDir.js";

const START_MARKER = "# >>> hermes-repo memory (do not edit this block manually)";
const END_MARKER = "# <<< hermes-repo memory";

export type GitignoreMergeAction = "created" | "updated" | "replaced" | "appended";

export function mergeHermesGitignore(repoRoot: string): {
  action: GitignoreMergeAction;
  warnBroadMemoryIgnore: boolean;
} {
  const block = readTemplate("gitignore-block.txt").trimEnd() + "\n";
  const gitignorePath = join(repoRoot, ".gitignore");
  const contentBefore = existsSync(gitignorePath)
    ? readFileSync(gitignorePath, "utf8")
    : "";

  const warnBroadMemoryIgnore =
    contentBefore.length > 0 &&
    !contentBefore.includes(START_MARKER) &&
    /(^|\n)\.memory\/\s*$/m.test(contentBefore);

  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `${block}\n`, "utf8");
    return { action: "created", warnBroadMemoryIgnore: false };
  }

  const startIdx = contentBefore.indexOf(START_MARKER);
  const endIdx = contentBefore.indexOf(END_MARKER);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = contentBefore.slice(0, startIdx);
    const after = contentBefore.slice(endIdx + END_MARKER.length);
    const next = `${before}${block}${after}`.replace(/\n{3,}/g, "\n\n");
    writeFileSync(gitignorePath, next.endsWith("\n") ? next : `${next}\n`, "utf8");
    return { action: "replaced", warnBroadMemoryIgnore };
  }

  if (startIdx !== -1) {
    const before = contentBefore.slice(0, startIdx);
    const next = `${before}${block}\n`;
    writeFileSync(gitignorePath, next, "utf8");
    return { action: "updated", warnBroadMemoryIgnore };
  }

  const separator = contentBefore.endsWith("\n") || contentBefore.length === 0 ? "\n" : "\n\n";
  writeFileSync(gitignorePath, `${contentBefore}${separator}${block}\n`, "utf8");
  return { action: "appended", warnBroadMemoryIgnore };
}
