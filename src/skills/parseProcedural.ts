import { extractSection, type ParsedCapture } from "../consolidate/parseCapture.js";

export interface ProceduralSections {
  goal: string;
  steps: string;
  cautions: string;
  verification: string;
}

export function parseProceduralSections(capture: ParsedCapture): ProceduralSections {
  const body = capture.bodyMarkdown;
  return {
    goal: extractSection(body, "目标"),
    steps: extractSection(body, "步骤"),
    cautions: extractSection(body, "注意"),
    verification: extractSection(body, "验证"),
  };
}

export function countStepsInText(stepsText: string): number {
  if (!stepsText.trim()) {
    return 0;
  }
  const numbered = stepsText.match(/^\s*\d+\./gm);
  if (numbered && numbered.length > 0) {
    return numbered.length;
  }
  return stepsText.split("\n").filter((l) => l.trim().length > 0).length;
}

export function proceduralSummary(capture: ParsedCapture): string {
  const { goal, steps } = parseProceduralSections(capture);
  const firstStep = steps
    .split("\n")
    .find((l) => l.trim() && !l.startsWith("#"))
    ?.trim();
  return (goal || firstStep || capture.summary).slice(0, 120);
}

export function captureTextBlob(capture: ParsedCapture): string {
  const { goal, steps, cautions } = parseProceduralSections(capture);
  return `${capture.tags.join(" ")} ${goal} ${steps} ${cautions} ${capture.summary}`.toLowerCase();
}
