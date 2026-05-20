import type { InitReport } from "../types.js";

export type AssistantId =
  | "claude-code"
  | "cursor"
  | "codex"
  | "copilot"
  | "copilot-cli";

export interface WriteContext {
  repoRoot: string;
  force: boolean;
  report: InitReport;
}

export interface AssistantAdapter {
  id: AssistantId;
  label: string;
  available: boolean;
  scaffoldPaths: string[];
  write(ctx: WriteContext): void;
}
