import { hookExit } from "../hookExit.js";
import {
  printApplyReport,
  printPreviewReport,
  printPrReport,
  runPromote,
} from "../promote/runPromote.js";

export async function runPromoteCommand(opts: {
  cwd?: string;
  preview?: boolean;
  pr?: boolean;
  apply?: boolean;
  manifest?: string;
  out?: string;
  dryRun?: boolean;
  strict?: boolean;
  captures?: string[];
}): Promise<void> {
  try {
    const modes = [opts.preview, opts.pr, opts.apply].filter(Boolean).length;
    if (modes !== 1) {
      throw new Error("specify exactly one of --preview, --pr, or --apply");
    }

    if (opts.preview) {
      const result = await runPromote({
        cwd: opts.cwd,
        mode: "preview",
        captureFilters: opts.captures,
      });
      if ("empty" in result && result.empty) {
        console.error("hermes-repo promote: no .promote markers found");
        hookExit(0, opts.strict);
        return;
      }
      if ("analyses" in result) {
        printPreviewReport(result.analyses);
      }
      hookExit(0, opts.strict);
      return;
    }

    if (opts.pr) {
      const result = await runPromote({
        cwd: opts.cwd,
        mode: "pr",
        outPath: opts.out,
        captureFilters: opts.captures,
      });
      if ("empty" in result && result.empty) {
        console.error("hermes-repo promote: no .promote markers found");
        hookExit(0, opts.strict);
        return;
      }
      if ("prBodyPath" in result) {
        printPrReport(result);
      }
      hookExit(0, opts.strict);
      return;
    }

    const result = await runPromote({
      cwd: opts.cwd,
      mode: "apply",
      manifestPath: opts.manifest,
      dryRun: opts.dryRun,
    });
    if ("approved" in result) {
      printApplyReport(result);
    }
    hookExit(0, opts.strict);
  } catch (err) {
    console.error(
      `hermes-repo promote: ${err instanceof Error ? err.message : String(err)}`,
    );
    hookExit(1, opts.strict);
  }
}
