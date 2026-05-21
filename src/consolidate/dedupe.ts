import { readFileSync, writeFileSync } from "node:fs";
import type { ParsedCapture } from "./parseCapture.js";

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function groupKey(c: ParsedCapture): string {
  const tags = [...c.tags].sort().join(",");
  return `${c.scope}::${tags}`;
}

function similarity(a: ParsedCapture, b: ParsedCapture): number {
  const na = normalizeText(a.summary).slice(0, 200);
  const nb = normalizeText(b.summary).slice(0, 200);
  if (!na || !nb) {
    return 0;
  }
  if (na === nb) {
    return 1;
  }
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length >= nb.length ? na : nb;
  return longer.includes(shorter) ? 0.85 : 0;
}

function updateFrontmatterConfidence(
  content: string,
  confidence: string,
  supersededBy?: string,
): string {
  const parts = content.split(/^---\s*$/m);
  if (parts.length < 3) {
    return content;
  }
  let fm = parts[1];
  fm = fm.replace(/^confidence:\s*.+$/im, `confidence: ${confidence}`);
  if (supersededBy) {
    if (/^superseded_by:/im.test(fm)) {
      fm = fm.replace(/^superseded_by:\s*.+$/im, `superseded_by: ${supersededBy}`);
    } else {
      fm = `${fm.trimEnd()}\nsuperseded_by: ${supersededBy}\n`;
    }
  }
  return `---\n${fm}---${parts.slice(2).join("---")}`;
}

export interface DedupeResult {
  /** 参与 consolidate 的有效 capture（去重后保留的代表） */
  active: ParsedCapture[];
  supersededPaths: string[];
}

export function dedupeCaptures(captures: ParsedCapture[]): DedupeResult {
  const groups = new Map<string, ParsedCapture[]>();
  for (const c of captures) {
    const key = groupKey(c);
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const active: ParsedCapture[] = [];
  const supersededPaths: string[] = [];

  for (const list of groups.values()) {
    if (list.length === 1) {
      active.push(list[0]);
      continue;
    }
    const sorted = [...list].sort((a, b) => {
      const llmA = a.llmUpgradedAt ? 1 : 0;
      const llmB = b.llmUpgradedAt ? 1 : 0;
      if (llmB !== llmA) {
        return llmB - llmA;
      }
      return b.date.localeCompare(a.date);
    });
    const keeper = sorted[0];
    active.push(keeper);
    for (let i = 1; i < sorted.length; i++) {
      const dup = sorted[i];
      if (similarity(keeper, dup) >= 0.8) {
        markSuperseded(dup, keeper.path);
        supersededPaths.push(dup.path);
      } else {
        active.push(dup);
      }
    }
  }

  return { active, supersededPaths };
}

function markSuperseded(capture: ParsedCapture, keeperPath: string): void {
  try {
    const raw = readFileSync(capture.absolutePath, "utf8");
    const updated = updateFrontmatterConfidence(
      raw,
      "superseded",
      keeperPath,
    );
    writeFileSync(capture.absolutePath, updated, "utf8");
    capture.confidence = "superseded";
    capture.supersededBy = keeperPath;
  } catch {
    // best effort
  }
}
