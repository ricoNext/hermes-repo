import type { RepoContext } from "../config/types.js";
import { runClaudeCodeCapture } from "./claude-code/run.js";
import { runCodexCapture } from "./codex/run.js";
import { runCodebuddyCapture } from "./codebuddy/run.js";
import { runCursorCapture } from "./cursor/run.js";
import {
  isClaudeCaptureHook,
  isCodexCaptureHook,
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
  const hasCodex = assistants.includes("codex");

  if (!hasClaude && !hasCursor && !hasCodebuddy && !hasCodex) {
    return { written: false, reason: "no capture assistant in config" };
  }

  const hook = options.hookInput;
  const debug = ctx.config.debug === true;
  const codebuddyFromHook = isCodebuddyCaptureHook(hook);
  const codexFromHook = isCodexCaptureHook(hook);
  const claudeFromHook = isClaudeCaptureHook(hook);
  const cursorFromHook = isCursorCaptureHook(hook);

  if (codebuddyFromHook && hasCodebuddy) {
    return runCodebuddyCapture(ctx.repoRoot, options.cwd, options.dryRun, {
      transcriptPath: hook?.transcriptPath ?? options.transcriptPath,
      debug,
    });
  }

  if (codexFromHook && hasCodex) {
    return runCodexCapture(ctx.repoRoot, options.cwd, options.dryRun, {
      hookInput: hook,
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
    if (!hasCursor && !hasCodebuddy && !hasCodex) {
      return claudeResult;
    }
  }

  if (hasCodex) {
    const codexResult = await runCodexCapture(
      ctx.repoRoot,
      options.cwd,
      options.dryRun,
      {
        hookInput: hook,
        transcriptPath: options.transcriptPath,
        debug,
      },
    );
    if (codexResult.written) {
      return codexResult;
    }
    if (!hasCursor && !hasCodebuddy) {
      return codexResult;
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
