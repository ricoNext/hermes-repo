import type { ParsedCapture } from "../consolidate/parseCapture.js";
import type { PromoteTarget } from "./types.js";

export function suggestTarget(capture: ParsedCapture): PromoteTarget {
  if (capture.type === "procedural") {
    return "skills";
  }
  return "topics";
}

export function targetHintForPr(target: PromoteTarget): string {
  if (target === "skills") {
    return "建议通过 `flush` 晋升到 `.memory/skills/`（本 CLI 不自动写 Skill）";
  }
  return "建议晋升到 `.memory/topics/`";
}
