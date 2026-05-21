import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { ExistingRulesScan } from "./types.js";

const MAX_EXCERPT = 3500;

const RULE_CANDIDATES = [
  "AGENTS.md",
  "CLAUDE.md",
  ".cursorrules",
] as const;

function readExcerpt(repoRoot: string, rel: string): string | null {
  const full = join(repoRoot, rel);
  if (!existsSync(full)) {
    return null;
  }
  try {
    const raw = readFileSync(full, "utf8");
    return raw.length > MAX_EXCERPT ? `${raw.slice(0, MAX_EXCERPT)}\n...(truncated)` : raw;
  } catch {
    return null;
  }
}

function collectCursorRules(repoRoot: string): Array<{ path: string; excerpt: string }> {
  const dir = join(repoRoot, ".cursor", "rules");
  if (!existsSync(dir)) {
    return [];
  }
  const out: Array<{ path: string; excerpt: string }> = [];
  try {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".md") && !name.endsWith(".mdc")) {
        continue;
      }
      const rel = `.cursor/rules/${name}`;
      const excerpt = readExcerpt(repoRoot, rel);
      if (excerpt) {
        out.push({ path: rel, excerpt });
      }
      if (out.length >= 3) {
        break;
      }
    }
  } catch {
    // ignore
  }
  return out;
}

export function collectExistingRules(repoRoot: string): ExistingRulesScan {
  const sources: Array<{ path: string; excerpt: string }> = [];
  for (const rel of RULE_CANDIDATES) {
    const excerpt = readExcerpt(repoRoot, rel);
    if (excerpt) {
      sources.push({ path: rel, excerpt });
    }
  }
  sources.push(...collectCursorRules(repoRoot));
  return { sources };
}
