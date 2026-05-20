import type { AssistantAdapter, WriteContext } from "./types.js";

/** v0.9+：init 写入 .cursor/ hooks；当前仅占位 */
export const cursorAdapter: AssistantAdapter = {
  id: "cursor",
  label: "Cursor",
  available: false,
  scaffoldPaths: [],
  write(_ctx: WriteContext): void {
    // not available in v0.1.x
  },
};
