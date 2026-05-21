import type { LlmConfig } from "../config/llmConfig.js";
import type { ProceduralGroup } from "./groupProcedural.js";

async function chatJson(
  llm: LlmConfig,
  system: string,
  user: string,
): Promise<unknown | null> {
  const url = `${llm.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), llm.timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${llm.apiKey}`,
      },
      body: JSON.stringify({
        model: llm.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return null;
    }
    return JSON.parse(content) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const SKILL_SYSTEM = `You generate a SKILL.md file for an AI coding agent (agentskills.io style).
Respond with JSON only:
{
  "description": "one paragraph when to use this skill",
  "steps": "markdown numbered steps body under ## 步骤 (no frontmatter)",
  "cautions": "bullet list for pitfalls or empty string",
  "verification": "bullet list for verification or empty string"
}
Use Chinese when captures are Chinese. Merge duplicate steps from multiple captures.`;

export interface LlmSkillExtract {
  description: string;
  steps: string;
  cautions: string;
  verification: string;
}

export async function generateSkillViaLlm(
  llm: LlmConfig,
  group: ProceduralGroup,
  existingSkill?: string,
): Promise<LlmSkillExtract | null> {
  const sources = group.captures
    .map((c) => `--- ${c.path} ---\n${c.bodyMarkdown}`)
    .join("\n\n")
    .slice(0, 12000);

  const user = `Skill slug: ${group.skillSlug}
Primary tag: ${group.primaryTagName}
Existing SKILL (if any):
${(existingSkill ?? "").slice(0, 6000)}

Procedural captures:
${sources}`;

  const parsed = (await chatJson(llm, SKILL_SYSTEM, user)) as {
    description?: string;
    steps?: string;
    cautions?: string;
    verification?: string;
  } | null;

  if (!parsed?.steps) {
    return null;
  }
  return {
    description: parsed.description ?? "",
    steps: parsed.steps,
    cautions: parsed.cautions ?? "",
    verification: parsed.verification ?? "",
  };
}

export function applyLlmSkillToMarkdown(
  baseMarkdown: string,
  extract: LlmSkillExtract,
  group: ProceduralGroup,
): string {
  const parts = baseMarkdown.split(/^---\s*$/m);
  if (parts.length < 3) {
    return baseMarkdown;
  }
  let fm = parts[1];
  if (extract.description) {
    fm = fm.replace(
      /description:\s*>[\s\S]*?(?=\n[a-z])/i,
      `description: >\n  ${extract.description.replace(/\n/g, " ")}\n`,
    );
  }

  const cautionsBlock = extract.cautions.trim()
    ? `\n## 常见陷阱\n\n${extract.cautions}\n`
    : "";

  const body = `## 步骤

${extract.steps}
${cautionsBlock}
## 验证

${extract.verification || "（无）"}
`;

  return `---\n${fm}---\n${body}`;
}
