import { loadRepoContext } from "../config/readConfig.js";
import { hookExit } from "../hookExit.js";
import { runSearch } from "../search/runSearch.js";
import type { CaptureMemoryType } from "../capture/types.js";

export function runSearchCommand(opts: {
  cwd?: string;
  keyword: string;
  type?: string;
  limit?: number;
  strict?: boolean;
}): void {
  try {
    const ctx = loadRepoContext(opts.cwd);
    if (!ctx) {
      throw new Error("not a hermes-repo project (run init first)");
    }
    const kw = opts.keyword?.trim();
    if (!kw) {
      throw new Error("keyword is required");
    }

    let type: CaptureMemoryType | undefined;
    if (opts.type) {
      const t = opts.type as CaptureMemoryType;
      if (!["semantic", "episodic", "procedural"].includes(t)) {
        throw new Error("--type must be semantic, episodic, or procedural");
      }
      type = t;
    }

    const hits = runSearch({
      repoRoot: ctx.repoRoot,
      keyword: kw,
      type,
      limit: opts.limit,
    });

    for (const h of hits) {
      console.log(`${h.path}\t${h.summary}`);
    }

    if (hits.length === 0) {
      console.error(`hermes-repo: no matches for "${kw}"`);
    } else {
      console.error(`hermes-repo: ${hits.length} match(es)`);
    }

    hookExit(0, opts.strict);
  } catch (err) {
    console.error(
      `hermes-repo search: ${err instanceof Error ? err.message : String(err)}`,
    );
    hookExit(1, opts.strict);
  }
}
