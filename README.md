# @riconext/hermes-repo

跨编程助手的**项目级记忆系统**：在任意 Git 仓库中沉淀约定、踩坑与可复用流程，让 Claude Code、Cursor、Codex 等 AI 助手越用越懂这个项目。

参考 [Hermes Agent](https://github.com/NousResearch/hermes) 的三层记忆模型与技能闭环思路；实现细节见 [设计文档](docs/hermes-repo-design.md)。

## 它能做什么

- **自动捕获**：会话结束时通过 Stop hook 读取 JSONL，质量过滤后写入结构化捕获（不阻塞日常开发）
- **分层检索**：`MEMORY.md` 注入上下文 → `search` / grep 查历史 → 可选 MCP + FTS5 语义搜索
- **三种记忆**：语义（约定/决策）、情景（事件经过）、流程（操作步骤，可晋升为 Skill）
- **团队共享**：个人层本地沉淀，审查后晋升到 `topics/`、`skills/`，经 PR 合并进团队真相源
- **反馈驱动**：引用记录与 `use_count` 决定哪些记忆留在摘要里，避免 MEMORY.md 膨胀

## 快速开始

```bash
# 在目标仓库根目录初始化（交互式）
npx @riconext/hermes-repo init

# CI / 非 TTY 环境须加 -y
npx @riconext/hermes-repo init -y

# 指定编程助手（当前仅 claude-code；多选逗号分隔）
npx @riconext/hermes-repo init -y --tools claude-code
```

交互式 `init` 会通过多选勾选要接入的助手；选择写入 `.memory/config.json` 的 `assistants` 字段。每次 `init` 都会**合并更新** `config.json`（含 `assistants`、`debug` 等），不会因文件已存在而跳过。

`init` 会创建：

```text
.memory/              # 记忆根目录
├── captures/         # [个人] 原始捕获（semantic / episodic / procedural）
├── topics/           # [团队] 整理后的主题
├── skills/           # [团队] 可复用技能（SKILL.md）
├── sessions/         # [个人] 会话索引
├── refs/             # [个人] AI 引用记录（反馈）
├── team/             # [团队] 决策与冲突处理记录
└── MEMORY.md         # [团队] 自动摘要（注入用，约 2.2K 字符上限）

AGENTS.md             # 编程助手指令入口
.claude/hooks.json    # Claude Code hooks（P0）
```

初始化后正常使用编程助手；**v0.2** 起 Stop hook 执行 `capture`（启发式过滤后写入 captures），SessionStart 执行 `inject`（将 `MEMORY.md` 注入上下文）。`consolidate` 自动更新 MEMORY 在 **v0.4** 实现。

## 工作流程

```text
init → 日常编码（AI 助手 + hooks）
         ↓
     Stop hook：过滤 → 提取 → 写入 captures/
         ↓
     consolidate：去重 / 冲突检测 → 更新 topics/ + MEMORY.md
         ↓
下次会话：AGENTS.md 引导加载 MEMORY.md，按需 search / 加载 Skill
```

## CLI 命令

| 命令 | 说明 |
|------|------|
| `init` | 创建 `.memory/`、`AGENTS.md`、hooks 配置 |
| `capture` | Stop hook：读 Claude JSONL → 启发式过滤 → 写入 `.memory/captures/`（**v0.2**） |
| `inject` | SessionStart：读 `MEMORY.md` 输出到 stdout，约 2200 字符上限（**v0.2**） |
| `flush` | 手动触发 consolidate |
| `search <关键词>` | 检索历史捕获与主题 |
| `stats` | 查看记忆健康度 |
| `promote` | 将个人捕获晋升到团队层（支持 `--pr`、`--preview`、`--apply`） |

冷启动扩展（规划中）：`init --scan`、`init --interview`、`clone` 从其他仓库复用记忆。

## 记忆类型

| 类型 | 含义 | 示例 |
|------|------|------|
| **semantic** | 项目事实与约定 | API 统一返回格式、认证方案 |
| **episodic** | 具体事件与结果 | 某次迁移超时及根因 |
| **procedural** | 可复用操作步骤 | 部署、数据库迁移流程（可晋升为 Skill） |

## 团队协作

个人层（`captures/`、`sessions/`、`refs/`）默认 **不提交 git**；团队层（`topics/`、`skills/`、`MEMORY.md`）经 PR 审查后提交。

```bash
# 标记某条捕获值得晋升
touch .memory/captures/semantic/capture-xxx.promote

# 生成勾选框形式的晋升 PR
npx @riconext/hermes-repo promote --pr
```

多人仓库下由 Memory Steward 轮值维护记忆健康度；详见设计文档中的「团队协作」与「记忆晋升 PR」章节。

## 支持的编程助手

| 优先级 | 工具 | hooks |
|--------|------|-------|
| P0 | Claude Code | Stop / SessionStart / PreCompact / PostCompact |
| P1 | Cursor | hooks.json |
| P1 | OpenAI Codex | hooks 系统 |
| P2 | VS Code Copilot | Agent hooks（Preview） |
| P2 | GitHub Copilot CLI | AGENTS.md |

v0.x 优先 Claude Code；其他适配器按路线图补齐。

## 设计原则

1. **先验证，后完善** — v0.x 用 Markdown / JSON 存储，快速验证闭环
2. **不阻塞用户** — hook 路径零 LLM，复杂提取与 consolidate 走后台
3. **记忆有边界** — 质量门槛过滤噪声，MEMORY.md 有大小上限
4. **渐进式采用** — 先跑通捕获与 consolidate，再扩展 Skill、MCP、FTS5
5. **反馈驱动** — 以 AI 是否引用记忆衡量价值，而非只写不读

## 路线图（摘要）

| 版本 | 内容 |
|------|------|
| v0.1 | `init`：目录 + AGENTS.md + hooks |
| v0.2 | Stop hook 捕获 + SessionStart 注入（**当前**） |
| v0.3 | 启发式 + LLM 提取，分类写入 captures |
| v0.4 | consolidate：去重、冲突检测、MEMORY.md |
| v0.5–v0.7 | Skill 晋升、反馈回路、冷启动 |
| v0.9+ | Cursor adapter、curator、MCP + SQLite FTS5 |

完整路线图与 LLM 成本分析见 [docs/hermes-repo-design.md](docs/hermes-repo-design.md)。

## 开发

```bash
bun install
bun run build
bun run test
bun run typecheck
```

### 调试 hook / capture / inject

在业务仓库的 `.memory/config.json` 中将 `"debug"` 设为 `true`（`init` 写入默认 `false`，重新 `init -y` 会为旧配置补上该字段）。下次 hook 或 CLI 执行时，会在 **stderr** 与 **`.memory/hermes-debug.log`** 双写 `hermes-repo [capture]` / `[inject]` 前缀的跳过或成功信息（`tail -f .memory/hermes-debug.log`）；`inject` 的 stdout 仍只输出 `MEMORY.md` 正文。

## 本地调试 CLI

```bash
node dist/cli.js --version
node dist/cli.js
```

## 文档

- [完整设计文档](docs/hermes-repo-design.md) — 架构、存储格式、consolidate、团队流程、AGENTS.md 模板
- [Phase 1 实施计划（v0.1 init）](docs/phase-1-v0.1-init.md) — `init` 命令交付范围、测试与验收标准
- [Phase 2 实施计划（v0.2 capture/inject）](docs/phase-2-v0.2-capture.md) — hooks 闭环、JSONL 契约、验收标准

## License

见 [LICENSE](LICENSE)。
