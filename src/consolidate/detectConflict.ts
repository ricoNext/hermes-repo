import { primaryTag, type ParsedCapture } from "./parseCapture.js";

export interface MemoryConflict {
  tag: string;
  scope: string;
  pathA: string;
  pathB: string;
  reason: string;
}

/** 互斥关键词对（小写匹配 findings/summary） */
const MUTEX_PAIRS: [string, string][] = [
  ["localstorage", "httponly"],
  ["local storage", "httponly"],
  ["mysql", "postgresql"],
  ["mysql", "postgres"],
  ["javascript", "typescript-only"],
  ["npm", "pnpm-only"],
];

function textBlob(c: ParsedCapture): string {
  return `${c.summary} ${c.findings}`.toLowerCase();
}

function hasTerm(blob: string, term: string): boolean {
  return blob.includes(term.toLowerCase());
}

function pairConflicts(a: string, b: string): boolean {
  for (const [x, y] of MUTEX_PAIRS) {
    const hasX = hasTerm(a, x) && hasTerm(b, y);
    const hasY = hasTerm(a, y) && hasTerm(b, x);
    if (hasX || hasY) {
      return true;
    }
  }
  return false;
}

export function detectConflicts(captures: ParsedCapture[]): MemoryConflict[] {
  const conflicts: MemoryConflict[] = [];
  const byTagScope = new Map<string, ParsedCapture[]>();

  for (const c of captures) {
    if (c.confidence === "superseded") {
      continue;
    }
    const tag = primaryTag(c);
    const key = `${c.scope}::${tag}`;
    const list = byTagScope.get(key) ?? [];
    list.push(c);
    byTagScope.set(key, list);
  }

  for (const [key, list] of byTagScope) {
    if (list.length < 2) {
      continue;
    }
    const [scopePart, tag] = key.split("::");
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const blobA = textBlob(a);
        const blobB = textBlob(b);
        if (pairConflicts(blobA, blobB)) {
          conflicts.push({
            tag,
            scope: scopePart,
            pathA: a.path,
            pathB: b.path,
            reason: "互斥断言（规则检测）",
          });
        }
      }
    }
  }

  return conflicts;
}
