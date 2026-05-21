# Phase 7：v0.12.0 冷启动（项目扫描）

> **状态**：已完成 · **版本**：`0.12.0` · **依赖**：[Phase 6 反馈回路](phase-6-v0.11-feedback.md)

## 目标

首次 `init` 时，用户可选择根据仓库现状生成首批 **semantic** 捕获，并自动 **flush** 产出可用 `MEMORY.md`。

## 入口

| 方式 | 行为 |
|------|------|
| 交互式 `init` | 在 LLM 配置后询问「是否根据项目扫描生成首批记忆」，**默认否** |
| 已有 captures | 二次确认「是否仍要扫描并追加」，**默认否** |
| `init -y --scan` | 非交互显式开启扫描 |

## 扫描信号

- `package.json` → 技术栈 capture
- `Dockerfile` / `Makefile` / `docker-compose` / `prisma` 等 → 基础设施
- `git log --oneline -50` → 近期活跃（需 Git）
- `AGENTS.md` / `CLAUDE.md` / `.cursor/rules` 等 → 迁移约定摘录

## 模块

| 路径 | 职责 |
|------|------|
| `src/coldstart/collectors/*` | 各信号采集 |
| `src/coldstart/buildScanCaptures.ts` | 生成 `FormattedCapture` |
| `src/coldstart/runProjectScan.ts` | 写入 `captures/semantic/` |
| `src/init/prompts.ts` | 交互 confirm |
| `src/init/runInit.ts` | 脚手架后扫描 + `runConsolidate` |

## 明确不做

- `init --interview`
- `hermes-repo clone`（Phase 8 已暂缓）
- 扫描时 LLM 润色

## 下一步

Phase 8–10 均已暂缓。Phase 11 `promote` 已完成（见 [phase-11-v0.13-promote.md](phase-11-v0.13-promote.md)）。候选：Phase 13 MCP 另仓。
