import { readFileSync, writeFileSync } from "node:fs";
import { setFrontmatterScalar } from "../markdown/frontmatter.js";
import type { ProceduralGroup } from "./groupProcedural.js";

/** 同 tag 组写回 repeat_count（组大小） */
export function writeRepeatCountsForGroups(groups: ProceduralGroup[]): void {
  for (const group of groups) {
    const count = group.captures.length;
    for (const c of group.captures) {
      try {
        const raw = readFileSync(c.absolutePath, "utf8");
        writeFileSync(
          c.absolutePath,
          setFrontmatterScalar(raw, "repeat_count", count),
          "utf8",
        );
        c.repeatCount = count;
      } catch {
        // best effort
      }
    }
  }
}
