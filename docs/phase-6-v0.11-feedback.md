# Phase 6：v0.11.0 反馈回路与生命周期

> **状态**：已完成 · **版本**：`0.11.0` · **依赖**：[Phase 5 skills](phase-5-v0.10-skills.md)

## 目标

度量记忆是否被真正使用：引用记录 → flush 聚合 → MEMORY 按活跃度裁剪 → `stats` / `search` 自查。

## CLI

| 命令 | 说明 |
|------|------|
| `ref --capture <path> --reason "..."` | 记录对 capture 的引用 |
| `ref --skill <slug> --reason "..."` | 记录对技能的引用 |
| `search <关键词>` | 搜索 captures / topics / skills |
| `stats [--json]` | 记忆健康度 |

`flush` 时自动：`aggregateRefs` → `applyLifecycle` → 更新 `MEMORY.md`。

## 数据流

1. **refs**：`.memory/refs/*.json`，flush 后聚合并**删除**文件
2. **capture**：frontmatter `use_count`、`last_used` 写回
3. **skill**：`.memory/skill-usage.json`（个人层，gitignore）
4. **生命周期**：
   - 30 天无活跃引用 → 不进 MEMORY（文件仍在 `captures/`）
   - 90 天闲置 → `.memory/.archive/captures/...`
   - `capture.md.ignore` 侧车 → 下次 flush 直接归档
5. **技能**：90 天无引用 → 从 MEMORY「可用技能」移除，`SKILL.md` 保留

## 模块

| 路径 | 职责 |
|------|------|
| `src/markdown/frontmatter.ts` | frontmatter 读写 |
| `src/feedback/*` | ref、聚合、skill-usage |
| `src/lifecycle/*` | eligibility、归档、ignore |
| `src/search/runSearch.ts` | 关键词搜索 |
| `src/stats/runStats.ts` | 健康度统计 |

## 验收

- `ref` + `flush` → `use_count` 更新、refs 清空
- 旧 capture 降级 / 归档 / `.ignore` 行为符合设计
- `stats`、`search` exit 0
- `bun run test` 全绿

## 明确不做

- MCP `mem-ref` / curator 周任务
- FTS / 语义搜索
- `promote --pr`（见 [phase-11-v0.13-promote.md](phase-11-v0.13-promote.md)）

## 下一步

Phase 7：冷启动（已完成，见 [phase-7-v0.12-coldstart.md](phase-7-v0.12-coldstart.md)）  
Phase 11：团队 promote（已完成，见 [phase-11-v0.13-promote.md](phase-11-v0.13-promote.md)）
