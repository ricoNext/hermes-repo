# Phase 4：v0.9.0 consolidate + flush + MEMORY.md

> **状态**：已完成 · **版本**：`0.9.0` · **依赖**：[Phase 3 LLM 捕获](phase-3-v0.8-llm-capture.md)

## 目标

将 `.memory/captures/` 聚合为可注入的 `MEMORY.md` 与 `topics/`，完成「捕获 → 摘要 → inject」闭环。

## 命令

| 命令 | 说明 |
|------|------|
| `hermes-repo flush` | 手动触发 consolidate |
| `hermes-repo flush --force` | 重处理全部活跃 capture |
| `hermes-repo flush --dry-run` | 预览，不写盘 |

与 `capture-llm --flush`（处理 LLM pending 队列）**不同**。

## 触发条件（自动）

capture 成功写盘后，后台 detached 执行 `flush`，当任一满足：

1. 新 capture ≥ 10
2. 距上次 consolidate ≥ 24h 且有新 capture
3. 规则检测到同 scope+tag 冲突
4. 存在 `captures/pending/*.json` 时**推迟**自动触发（手动 `flush` 不受限）

## 配置

- **LLM**：复用 `.memory/llm.json`；启用时 LLM 更新 topics + MEMORY，失败则规则降级
- **状态**：`.memory/consolidate-state.json`（gitignore）
- **锁**：`.memory/.consolidate.lock`（gitignore）

## 模块

| 路径 | 职责 |
|------|------|
| `src/consolidate/parseCapture.ts` | 解析 capture frontmatter |
| `src/consolidate/dedupe.ts` | 去重，标记 `superseded` |
| `src/consolidate/detectConflict.ts` | 规则互斥检测 |
| `src/consolidate/buildTopics.ts` | 写入 `topics/<slug>.md` |
| `src/consolidate/buildMemory.ts` | 生成 `MEMORY.md`（≤2200 字） |
| `src/consolidate/runConsolidate.ts` | 编排 |
| `src/consolidate/scheduleConsolidate.ts` | 自动调度 + flush 入口 |

## 验收

- `hermes-repo flush` 后 `MEMORY.md` 非 init 占位
- `inject` 输出真实摘要
- `llm.json` 关闭时无网络可运行
- `bun run test` 全通过

## 明确不做

- `search` CLI（Phase 6 / 横切）
- Skill 晋升、curator、多 scope `MEMORY-*.md`

## 与 Phase 5

Phase 5（v0.10.0）在 flush 时消费 `procedural/` 晋升 `skills/`；本阶段不生成 SKILL。见 [phase-5-v0.10-skills.md](phase-5-v0.10-skills.md)。
