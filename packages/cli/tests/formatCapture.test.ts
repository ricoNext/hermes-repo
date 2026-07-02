import { describe, expect, it } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonlFile } from "../src/capture/claude-code/parseJsonl.js";
import { simpleFormat } from "../src/capture/formatCapture.js";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
);

describe("formatCapture", () => {
  it("simpleFormat tags include assistant id", () => {
    const session = parseJsonlFile(join(fixturesDir, "session-rich.jsonl"));
    const formatted = simpleFormat(session, "cursor");
    expect(formatted.tags).toContain("cursor");
    expect(formatted.tags).toContain("auto-capture");
  });
});
