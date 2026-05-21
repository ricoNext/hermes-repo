import type { LlmConfig } from "../config/llmConfig.js";

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

const TOPIC_SYSTEM = `You maintain a project memory topic file in Markdown.
Respond with JSON only: { "body": "<markdown without frontmatter>" }
Use Chinese when source captures are Chinese. Keep concise bullets and headings.`;

const MEMORY_SYSTEM = `You generate a project MEMORY.md summary for AI session injection.
Respond with JSON only:
{
  "activeTopics": "markdown bullet list",
  "recentExperience": "markdown bullet list",
  "conventions": "markdown bullet list",
  "skills": "markdown bullet list for available skills (name + one line description)",
  "conflicts": "markdown bullet list or empty"
}
Each section is markdown fragments only (no top-level #). Stay under 1800 characters total.`;

const COMPRESS_SYSTEM = `Compress the MEMORY.md draft to fit injection limit.
Respond with JSON only: { "memory": "<full markdown document starting with # 项目记忆>" }
Preserve section structure. Use Chinese if input is Chinese.`;

export async function updateTopicViaLlm(
  llm: LlmConfig,
  tag: string,
  existingBody: string,
  newSummaries: string[],
): Promise<string | null> {
  const user = `Tag: ${tag}
Existing topic:
${existingBody.slice(0, 4000)}

New captures:
${newSummaries.join("\n---\n").slice(0, 6000)}`;

  const parsed = (await chatJson(llm, TOPIC_SYSTEM, user)) as {
    body?: string;
  } | null;
  return typeof parsed?.body === "string" ? parsed.body : null;
}

export async function generateMemoryViaLlm(
  llm: LlmConfig,
  topicSummaries: string,
  recentLines: string,
  conflictsText: string,
  statsLine: string,
  skillsText = "",
): Promise<{
  activeTopics: string;
  recentExperience: string;
  conventions: string;
  skills: string;
  conflicts: string;
} | null> {
  const user = `Stats: ${statsLine}
Topic summaries:
${topicSummaries.slice(0, 5000)}

Recent captures:
${recentLines.slice(0, 4000)}

Available skills:
${skillsText.slice(0, 2000)}

Conflicts:
${conflictsText}`;

  const parsed = (await chatJson(llm, MEMORY_SYSTEM, user)) as {
    activeTopics?: string;
    recentExperience?: string;
    conventions?: string;
    skills?: string;
    conflicts?: string;
  } | null;

  if (!parsed) {
    return null;
  }
  return {
    activeTopics: parsed.activeTopics ?? "",
    recentExperience: parsed.recentExperience ?? "",
    conventions: parsed.conventions ?? "",
    skills: parsed.skills ?? "",
    conflicts: parsed.conflicts ?? "",
  };
}

export async function compressMemoryViaLlm(
  llm: LlmConfig,
  draft: string,
  maxChars: number,
): Promise<string | null> {
  const user = `Max chars: ${maxChars}\n\nDraft:\n${draft}`;
  const parsed = (await chatJson(llm, COMPRESS_SYSTEM, user)) as {
    memory?: string;
  } | null;
  return typeof parsed?.memory === "string" ? parsed.memory : null;
}
