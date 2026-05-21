# Phase 11：v0.13.0 团队工作流（promote）

> **状态**：已完成 · **版本**：`0.13.0` · **依赖**：[Phase 5 skills](phase-5-v0.10-skills.md)、[Phase 7 冷启动](phase-7-v0.12-coldstart.md)

## 目标

将带 `.promote` 侧车的**个人层**捕获，经人工审查晋升到**团队层** `.memory/topics/`（可提交 git）。首版不自动 `git` / `gh`，通过本地 manifest 落盘。

## 与 Phase 5 的区别

| | Phase 5 `flush` | Phase 11 `promote` |
|--|-----------------|-------------------|
| 触发 | 自动 consolidate | 人工 CLI |
| 目标 | `.memory/skills/` | `.memory/topics/` |
| 侧车 | procedural → Skill | 全类型 → 团队 topic（procedural 在 PR 中提示走 Skill） |

## CLI

```bash
# 预览候选（不写盘）
hermes-repo promote --preview

# 生成 PR 正文 + staging 草案 + decisions 模板
hermes-repo promote --pr [--out path] [captures...]

# 评审后落盘
cp .memory/promote/decisions.template.json decisions.json
# 编辑 decisions.json 后：
hermes-repo promote --apply --manifest decisions.json

# 刷新 MEMORY.md
hermes-repo flush
```

## 输出物（`--pr`）

| 路径 | 说明 |
|------|------|
| `.memory/promote/pr-YYYY-MM-DD.md` | 填充后的 PR 正文 |
| `.memory/promote/staging/topics/<slug>.md` | topic 草案（gitignore） |
| `.memory/promote/decisions.template.json` | manifest 模板 |

`.memory/promote/` 已在 init 的 gitignore 块中忽略。

## Manifest

```json
{
  "generatedAt": "2026-05-20",
  "decisions": [
    {
      "capturePath": "captures/semantic/foo.md",
      "action": "approve",
      "target": "topics"
    },
    {
      "capturePath": "captures/episodic/bar.md",
      "action": "defer"
    }
  ]
}
```

- `approve`：合并 staging → `topics/`，删除 `.promote`
- `reject`：删除 `.promote`，capture 写入 `promote_rejected_at`
- `defer`：保留 `.promote`

`target: skills` 的 approve **不支持**（避免与 `flush` 双写）；流程 Skill 仍用 `flush` + `.promote`。

## LLM

有 `.memory/llm.json` 且 `enabled` 时：

- PR 条目说明（`analyzeNoteViaLlm`）
- topic 草案（复用 `updateTopicViaLlm`）

无 LLM 时规则路径仍可用。

## 模块

| 路径 | 职责 |
|------|------|
| `src/promote/listPromoteCandidates.ts` | 扫描 `.promote` 侧车 |
| `src/promote/detectTopicConflict.ts` | 捕获 vs 现有 topic 互斥检测 |
| `src/promote/buildTopicDraft.ts` | staging 草案正文 |
| `src/promote/buildPrBody.ts` | 填充 `PROMOTE_PR.md` |
| `src/promote/applyDecisions.ts` | manifest 落盘 |
| `src/promote/runPromote.ts` | 编排 |
| `src/commands/promote.ts` | CLI |

## 验收

- `promote --pr` 不修改正式 `topics/`，直至 `--apply`
- `promote --apply` 按 manifest 写入并处理侧车
- 无 LLM 时 `--pr` / `--preview` 可用
- `bun run test` 全绿（promote 相关）

## 明确不做（二期）

- `--auto-safe`
- `git` 分支 + `gh pr create`
- 从 PR 正文解析勾选框

## 下一步

Dogfood 团队晋升流程；可选 MCP（Phase 13 另仓）。
