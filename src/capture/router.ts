import type { RepoContext } from "../config/types.js";
import { runClaudeCodeCapture } from "./claude-code/run.js";
import { runCodebuddyCapture } from "./codebuddy/run.js";
import { runCursorCapture } from "./cursor/run.js";
import {
  isClaudeCaptureHook,
  isCodebuddyCaptureHook,
  isCursorCaptureHook,
  type HookInput,
} from "./hookInput.js";
import type { CaptureResult } from "./types.js";

export async function routeCapture(
  ctx: RepoContext,
  options: {
    cwd?: string;
    dryRun?: boolean;
    transcriptPath?: string;
    hookInput?: HookInput | null;
  },
): Promise<CaptureResult> {
  const assistants = ctx.config.assistants;
  const hasClaude = assistants.includes("claude-code");
  const hasCursor = assistants.includes("cursor");
  const hasCodebuddy = assistants.includes("codebuddy");

  if (!hasClaude && !hasCursor && !hasCodebuddy) {
    return { written: false, reason: "no capture assistant in config" };
  }

  const hook = options.hookInput;
  const debug = ctx.config.debug === true;
  const codebuddyFromHook = isCodebuddyCaptureHook(hook);
  const claudeFromHook = isClaudeCaptureHook(hook);
  const cursorFromHook = isCursorCaptureHook(hook);

  if (codebuddyFromHook && hasCodebuddy) {
    return runCodebuddyCapture(ctx.repoRoot, options.cwd, options.dryRun, {
      transcriptPath: hook?.transcriptPath ?? options.transcriptPath,
      debug,
    });
  }

  if (claudeFromHook && hasClaude) {
    return runClaudeCodeCapture(ctx.repoRoot, options.cwd, options.dryRun, {
      transcriptPath: hook?.transcriptPath ?? options.transcriptPath,
      debug,
    });
  }

  if (cursorFromHook && hasCursor) {
    return runCursorCapture(ctx.repoRoot, options.cwd, options.dryRun, {
      hookInput: hook,
      debug,
    });
  }

  if (hasClaude) {
    const claudeResult = await runClaudeCodeCapture(
      ctx.repoRoot,
      options.cwd,
      options.dryRun,
      {
        transcriptPath: options.transcriptPath,
        debug,
      },
    );
    if (claudeResult.written) {
      return claudeResult;
    }
    if (!hasCursor && !hasCodebuddy) {
      return claudeResult;
    }
  }

  if (hasCursor) {
    const cursorResult = await runCursorCapture(
      ctx.repoRoot,
      options.cwd,
      options.dryRun,
      {
        hookInput: hook,
        debug,
      },
    );
    if (cursorResult.written) {
      return cursorResult;
    }
    if (!hasCodebuddy) {
      return cursorResult;
    }
  }

  if (hasCodebuddy) {
    return runCodebuddyCapture(ctx.repoRoot, options.cwd, options.dryRun, {
      transcriptPath: options.transcriptPath,
      debug,
    });
  }

  return { written: false, reason: "no capture assistant in config" };
}
