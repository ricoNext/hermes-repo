# Phase 5：v0.10.0 流程记忆 → Skill

> **状态**：已完成 · **版本**：`0.10.0` · **依赖**：[Phase 4 consolidate](phase-4-v0.9-consolidate.md)

## 目标

将 `captures/procedural/` 晋升为 `.memory/skills/<slug>/SKILL.md`，并在 `MEMORY.md` 注入「可用技能」Level 0 目录。

## 晋升条件（OR）

1. 同主 tag 的 procedural **≥ 3** 条
2. 存在 `captures/.../<file>.md.promote` 侧车（单条即可）
3. 高风险关键词（deploy / migration / rollback 等）且组内 **≥ 1** 条

不晋升：步骤 ≤ 3 且无 `.promote` 且无高风险（过简流程）。

## 集成方式

在 `hermes-repo flush` / consolidate 流水线中，`buildTopics` 之后、`buildMemory` 之前执行 `promoteSkills`（无独立 hook）。

## 模块

| 路径 | 职责 |
|------|------|
| `src/skills/groupProcedural.ts` | 分组与晋升判定 |
| `src/skills/promoteSkills.ts` | 写 SKILL.md |
| `src/skills/renderSkillMd.ts` | 规则模板 |
| `src/skills/llmSkill.ts` | LLM 生成（复用 `llm.json`） |
| `src/skills/skillIndex.ts` | Level 0 索引 → MEMORY |
| `src/skills/repeatCount.ts` | 写回 `repeat_count` |

## 命令

无新 CLI；`flush` 完成后 stderr 报告 `N skill(s)`。

## 验收

- 3 条同 tag 或 `.promote` → `skills/<slug>/SKILL.md`
- `MEMORY.md` 含 `## 可用技能`
- 非 procedural 的 `.promote` 仅 warn，不写 skills

## 明确不做

- `promote --pr`（Phase 11）
- `search` / `stats`（Phase 6）
- `skills/*/references/`、`scripts/` 自动生成

## 与 Phase 6

Phase 6 可做技能版本治理、`refs` 引用统计与低活跃降级；本阶段已在步骤变化时 bump `version` patch。
