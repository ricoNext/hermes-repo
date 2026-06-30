# hermes-repo

**把 AI 编程助手的项目记忆放回 Git 仓库。** hermes-repo 会把助手 hooks 接到当前仓库里：会话结束时捕获有价值的上下文，需要时用 LLM 整理成 `.memory/` 下的知识文件，并在后续会话开始时自动注入。

npm：`@riconext/hermes-repo` · 灵感来自 [Hermes Agent](https://github.com/NousResearch/hermes) 的记忆与技能闭环 · [English](README.md)

![](https://neptune-ipc.oss-cn-shenzhen.aliyuncs.com/img/20260521182425723.png)

## 当前真实能力

hermes-repo 目前提供单仓库记忆闭环：

| 能力 | 当前行为 |
|------|----------|
| 助手接入 | `init` 创建 `.memory/`，合并 `AGENTS.md`，并为选择的助手写入 hook 配置 |
| 会话捕获 | Stop hook 把会话摘要写入 `.memory/captures/raw/session-*.md` |
| 会话注入 | SessionStart hook 输出 `.memory/MEMORY.md` 和 `.memory/rules/*.md` 全文 |
| LLM 捕获升级 | 配好 LLM 后，`capture-llm --flush` 处理排队的捕获升级任务 |
| 知识整理 | `flush` 调用 OpenAI 兼容 LLM，把原始捕获整理成知识文件并更新 `MEMORY.md` |
| 多助手支持 | 已有 Claude Code、Cursor、CodeBuddy、OpenAI Codex 适配器 |

当前没有暴露为 CLI 的命令：`search`、`stats`、`ref`、`promote`、`init --scan`。部分旧设计文档可能提到这些规划或历史工作流；README 以当前已发布 CLI 为准。

## 为什么需要

AI 编程会话经常丢失本地项目上下文：

- 每个新会话都要重新说明包管理器、命名风格、API 形态。
- 上周解释过的 bug 根因，后来还得在聊天记录里翻。
- 团队知识没有跟仓库一起版本化，助手上下文容易漂移。

hermes-repo 把工作记忆留在 repo 里。原始捕获默认留在本地；整理后的知识文件可以像普通项目文档一样 review、修改、提交。

## 五分钟上手

在项目 Git 根目录执行：

```bash
npx @riconext/hermes-repo init
```

交互式 `init` 会询问：

- 目标仓库目录
- 要接入哪些助手
- 是否复制示例 capture 模板

它不会询问 LLM 密钥。如果要使用 `flush` 或 `capture-llm`，需要手动编辑 `.memory/config.json`。

非交互初始化：

```bash
npx @riconext/hermes-repo init -y --tools claude-code
npx @riconext/hermes-repo init -y --tools claude-code,cursor,codebuddy,codex
```

之后正常使用助手：

1. 会话开始时，hook 运行 `inject`。
2. 会话结束时，hook 运行 `capture`。
3. 积累了原始捕获且已配置 LLM 后，手动整理：

```bash
npx @riconext/hermes-repo flush
```

## 整体架构

```text
用户运行: npx @riconext/hermes-repo init
        |
        v
创建/合并:
  .memory/
    config.json              # 本地配置，包含 LLM key，gitignored
    MEMORY.md                # 会话注入用导航摘要
    rules/                   # 每次注入时全文加载
    domains/general/         # 领域知识
    workflows/               # 可复用流程
    decisions/               # 架构/产品决策
    incidents/               # 踩坑和根因记录
    captures/raw/            # 原始会话捕获，gitignored
    captures/archived/       # 已归档捕获，gitignored
    consolidate-state.json   # 本地处理状态，gitignored
  AGENTS.md                  # 共享助手引导
  assistant hook config      # .claude, .cursor, .codebuddy, .codex

运行时:
  SessionStart -> hermes-repo inject
    读取 MEMORY.md + rules/*.md
    按助手 hook 协议输出

  Stop -> hermes-repo capture
    解析当前助手 transcript
    追加到 captures/raw/session-{id}.md
    可选：排队后台 LLM 升级任务

  手动 -> hermes-repo flush
    需要已配置 LLM
    读取 pending/stale 原始会话
    写入 rules/domains/workflows/decisions/incidents
    重新生成 MEMORY.md
```

## 存储模型

| 层级 | 路径 | Git 行为 | 用途 |
|------|------|----------|------|
| 本地/个人 | `.memory/config.json`、`.memory/captures/`、`.memory/consolidate-state.json`、`.memory/.consolidate.lock` | init 写入的 gitignore 块会忽略 | 密钥、会话记录、本地处理状态 |
| 共享知识 | `.memory/MEMORY.md`、`.memory/rules/`、`.memory/domains/`、`.memory/workflows/`、`.memory/decisions/`、`.memory/incidents/` | init 写入的 gitignore 块会重新放行 | 给后续会话使用的项目知识 |
| 助手引导 | `AGENTS.md`、已选择助手的配置文件 | 除非你自己的 gitignore 排除，否则按普通仓库文件处理 | 告诉助手如何使用记忆 |

当前的团队协作方式就是普通 Git 流程：检查生成的知识文件，必要时手动编辑，然后通过 PR 提交。当前版本没有 `promote` CLI。

## LLM 配置

`capture` 和 `inject` 不依赖 LLM。`flush` 和成功的 `capture-llm` 升级需要 LLM 配置。

hermes-repo 使用 OpenAI 兼容的 Chat Completions 接口：

```json
{
  "llm": {
    "enabled": true,
    "provider": "openai",
    "baseUrl": "https://api.deepseek.com",
    "model": "deepseek-chat",
    "apiKey": "你的密钥",
    "timeoutMs": 60000,
    "maxInputChars": 24000,
    "mode": "async"
  },
  "consolidate": {
    "autoFlush": {
      "enabled": true,
      "minPendingSessions": 3,
      "minIntervalMinutes": 30,
      "maxPendingChars": 20000
    }
  }
}
```

注意事项：

- `enabled`、`apiKey`、`baseUrl`、`model` 都必须完整配置，LLM 调用才会发生。
- `baseUrl` 是服务根地址；hermes-repo 会请求 `{baseUrl}/chat/completions`。
- 不直接支持 Anthropic 或 Gemini 原生接口。需要通过 OpenAI 兼容网关使用。
- `.memory/config.json` 可能包含 `apiKey`，默认会被 gitignore。
- 新项目默认开启 `consolidate.autoFlush.enabled`。它可以在 capture 达到阈值后后台触发 `flush`，但同样需要 LLM 配置。

手动处理排队的捕获升级：

```bash
npx @riconext/hermes-repo capture-llm --flush
```

## 支持的助手

| 助手 | `init` 写入 | 运行时行为 |
|------|-------------|------------|
| Claude Code | `.claude/settings.local.json` | SessionStart inject，Stop capture |
| Cursor | `.cursor/hooks.json` | sessionStart inject，stop capture |
| CodeBuddy | `.codebuddy/settings.local.json` | SessionStart inject，Stop capture |
| OpenAI Codex | `.codex/config.toml`、`.codex/hooks.json` | SessionStart inject，Stop capture |

非交互模式默认选择 `claude-code`。

## CLI

```bash
npx @riconext/hermes-repo init [options]
npx @riconext/hermes-repo capture [options]
npx @riconext/hermes-repo inject [options]
npx @riconext/hermes-repo capture-llm [options]
npx @riconext/hermes-repo flush [options]
```

### `init`

初始化记忆目录和助手 hook 配置。

选项：

- `-y, --yes`：非交互模式
- `--tools <ids>`：逗号分隔的助手 id，需要和 `-y` 一起使用
- `-f, --force`：刷新脚手架文件和受管理的标记块
- `-C, --cwd <dir>`：目标目录

已知助手 id：`claude-code`、`cursor`、`codebuddy`、`codex`。

### `capture`

通常由助手 Stop hook 调用。它读取 hook stdin，解析助手 transcript，并追加到 `.memory/captures/raw/session-{id}.md`。

选项：

- `-C, --cwd <dir>`
- `--dry-run`
- `--strict`

### `inject`

通常由助手 SessionStart hook 调用。它输出 `MEMORY.md` 和所有 `rules/*.md`，并为 Cursor、Codex 使用对应的 JSON 输出格式。

选项：

- `-C, --cwd <dir>`
- `--strict`

### `capture-llm`

处理 pending 的捕获升级任务。

选项：

- `-C, --cwd <dir>`
- `--job <id>`
- `--flush`
- `--strict`

### `flush`

对 pending 或 stale 的原始会话捕获执行 LLM 整理。

选项：

- `-C, --cwd <dir>`
- `--force`
- `--dry-run`
- `--strict`

如果 LLM 未启用或配置不完整，`flush` 默认会为了 hook 安全以成功状态退出，但会打印 `LLM not enabled in config.json`。需要非零退出码时使用 `--strict`。

## 排障

在 `.memory/config.json` 开启 debug：

```json
{
  "debug": true
}
```

常用日志：

- `.memory/logs/capture.log`
- `.memory/logs/flush.log`
- `.memory/logs/consolidate.log`

本地调试 CLI：

```bash
bun run build
node dist/cli.js --help
```

## 开发

```bash
bun install
bun run build
bun run test
bun run typecheck
```

发布辅助命令：

```bash
bun run changeset
bun run release
```

## 路线图

规划中的方向包括记忆搜索、统计、显式反馈/引用记录、带评审的晋升工作流、冷启动扫描，以及基于 MCP 的检索。这些不是当前 CLI 能力，除非未来版本实现。

## License

[MIT](LICENSE)
