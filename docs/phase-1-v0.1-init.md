# Phase 1：v0.1 `init` 命令实施计划

> **状态**：已完成 · **预计**：1–2 天 · **依赖**：[Phase 0 工程基座](.cursor/plans/phase_0_工程基座_99a99c4b.plan.md)（已完成）
>
> **设计依据**：[hermes-repo-design.md](hermes-repo-design.md) § 整体架构、存储设计、AGENTS.md 模板、路线图 v0.1

## 现状

| 已有 | 缺失 |
|------|------|
| Phase 0 工程基座：`commander` 根命令、`readPkgVersion()`、Node ≥20 门禁、Vitest 冒烟（`tests/cli.test.ts`） | `init` 子命令及全部脚手架逻辑 |
| [hermes-repo-design.md](hermes-repo-design.md) 完整定义：目录树、AGENTS.md 模板、hooks、gitignore 分层、`config.json` | `src/commands/`、`templates/`、模板加载与写入 |
| [README.md](../README.md) 快速开始已描述 `init` 产物 | 行为与文档尚未落地 |
| 根 [.gitignore](../.gitignore) 已忽略整个 `.memory/`（dogfood 用） | 目标仓库 init 时需写入**分层** gitignore 块 |
| `package.json` version `0.0.0`，无 `@inquirer/prompts` | v0.1 依赖与版本号 bump |

**策略**：在 Phase 0 骨架上增量实现 `init`，只交付脚手架；`capture` / `inject` / `consolidate` / LLM / `--scan` 明确不做。hooks 仍指向未来命令（v0.2 实现），属预期行为。

**与设计的已知差异（Phase 1 处理）**：

- 设计文档 gitignore 含 `!.memory/AGENTS.md`，但 AGENTS.md 在**仓库根**；init 生成的 gitignore 块不引用该路径，根目录 `AGENTS.md` 默认提交。
- `MEMORY-frontend.md` / `MEMORY-backend.md`：v0.1 **不预创建**空文件（避免无意义 diff）；consolidate 阶段再生成。若交互模式勾选「多 scope 摘要」再创建空占位（可选增强）。

---

## 目标

在任意 Git 仓库根目录执行 `npx @riconext/hermes-repo init`（或 `init -y`）后：

1. 创建符合 `storage.backend: file` 的完整 `.memory/` 目录树（含 `config.json`、占位 `MEMORY.md`）。
2. 写入精简版 `AGENTS.md`（基于设计模板，保留记忆系统、检索、捕获、团队协作核心段落）。
3. 写入 `.claude/hooks.json`：`Stop` → `capture`，`SessionStart` → `inject`（命令本身 Phase 2 实现）。
4. 向项目 `.gitignore` **合并**个人层忽略 + 团队层放行规则（带标记块，可重复执行）。
5. 支持交互模式（`@inquirer/prompts`）与非交互 `-y`；**非 TTY 且无 `-y` 时必须失败并提示**。
6. **幂等**：重复 `init` 不破坏已有用户数据；默认跳过已存在脚手架文件，可选 `--force` 覆盖；**例外**：`.memory/config.json` 每次 `init` 均合并写入（见 §4 与 [设计文档 config 写入策略](hermes-repo-design.md)）。

```mermaid
flowchart TD
  A[hermes-repo init] --> B{stdin.isTTY 且非 -y?}
  B -->|是| C[@inquirer 询问选项]
  B -->|否| D{-y?}
  D -->|否| E[stderr 提示并 exit 1]
  D -->|是| F[默认选项]
  C --> F
  F --> G[解析 targetDir 默认 cwd]
  G --> H[创建 .memory 目录树]
  H --> I[写入 config.json / MEMORY.md / 可选 templates]
  I --> J[写入 AGENTS.md / .claude/hooks.json]
  J --> K[合并 .gitignore 标记块]
  K --> L[stdout 摘要: created / skipped]
```

---

## 交付清单

### 1. 依赖与版本

| 项 | 内容 |
|----|------|
| 运行时依赖 | `@inquirer/prompts`（仅 `init` 交互） |
| 版本 | `package.json` → `0.1.1`（v0.1.x：含 `assistants` 多选） |
| 构建 | `tsup` 增加 `onSuccess`：将 `templates/**` 复制到 `dist/templates/**` |
| 发布 | `files` 仍仅 `dist`；运行时通过 `import.meta.url` 解析 `../templates/` |

### 2. CLI 注册（`src/cli.ts`）

```typescript
program
  .command("init")
  .description("在当前 Git 仓库初始化 .memory/ 记忆脚手架")
  .option("-y, --yes", "非交互模式，使用默认选项")
  .option("-f, --force", "覆盖已存在的脚手架文件（不删除 captures 等内容）")
  .option("-C, --cwd <dir>", "目标目录，默认 process.cwd()")
  .option("--tools <ids>", "逗号分隔助手 id，如 claude-code（须与 -y 合用）")
  .action(runInitCommand);
```

**行为**：

- 无参数且 TTY → 交互（含编程助手 **checkbox** 多选；v0.1.1 仅 `claude-code` 可选）。
- `-y` → 默认 `assistants: ["claude-code"]`、写入 capture 示例模板、合并 gitignore、不 `--force`。
- `-y --tools claude-code` → 非交互指定助手。
- 二次 init → `config.assistants` 与已有配置 **并集** 合并。
- `!process.stdin.isTTY && !options.yes` → `exit(1)`，消息示例：`init requires -y in non-interactive environments`。
- `init` 注册后，无参 `hermes-repo` 的 help 应列出 `init`（更新 `tests/cli.test.ts`）。

### 3. 目录树（init 创建）

```text
<repo-root>/
├── .memory/
│   ├── config.json
│   ├── MEMORY.md
│   ├── captures/
│   │   ├── semantic/
│   │   ├── episodic/
│   │   └── procedural/
│   ├── personal/
│   ├── sessions/
│   │   └── index.json
│   ├── refs/
│   ├── topics/
│   ├── skills/
│   ├── team/
│   │   ├── decisions/
│   │   ├── conflict-resolutions/
│   │   └── steward-log.md
│   ├── templates/
│   └── .archive/
├── AGENTS.md
└── .claude/                    # 仅当 assistants 含 claude-code
    └── hooks.json
```

**按 `assistants` 条件创建**：未选中的助手不写入其 hooks；v0.1.1 不删除已存在但未选中的 hooks 文件。

**不创建**（留给 v0.4+ / consolidate）：`MEMORY-frontend.md`、`MEMORY-backend.md`、`memory.db`、具体 `topics/*.md` 内容。

### 4. `.memory/config.json`（v0.1 最小，v0.2.1+ 扩展）

```json
{
  "version": 1,
  "storage": {
    "backend": "file"
  },
  "assistants": ["claude-code"],
  "debug": false
}
```

| 字段 | 说明 |
|------|------|
| `version` | 固定 `1`，供未来迁移 |
| `storage.backend` | 固定 `"file"`；v1.1+ 可扩展 `"mcp"` |
| `assistants` | 用户在 init 时启用的编程助手 id 列表 |
| `debug` | v0.2.1+：`true` 时 `capture` / `inject` 双写 stderr 与 `.memory/hermes-debug.log`；init 默认 `false` |

不写入 `storage.mcp`（MCP 为远期）。

**写入策略（v0.2.1+，与 Phase 1 原「已存在则 skip」不同）**：

| 场景 | 行为 |
|------|------|
| 无 `config.json` | 创建并填入本次 `assistants`（及 `debug: false` 等） |
| 已有 `config.json` | **每次 init 合并写入**：更新 `version`、`storage.backend`、`assistants`（与文件内已有 id **并集**）；`debug` 若已是 `true` 则保留，否则写 `false`；保留用户自定义的其它顶层字段与 `storage` 子字段 |
| 实现 | `src/init/mergeConfig.ts` → `mergeConfigForInit()` |

详见 [hermes-repo-design.md § 配置](hermes-repo-design.md)。

### 5. `.memory/MEMORY.md`（占位）

- 标题 `# 项目记忆`
- `最后更新` / `总计` 占位（0 条）
- 空章节：`## 活跃主题`、`## 最近经验`、`## 项目约定`、`## 检索提示`（含 `npx @riconext/hermes-repo search` 文案）

### 6. `AGENTS.md`（精简模板）

源：设计文档「AGENTS.md 模板」。

**保留章节**：记忆系统、使用记忆、技能使用、何时搜索、记录新经验、团队协作、引用记录、禁止项。

**省略或一句带过**：过长 promote PR 细节（链到 `templates/PROMOTE_PR.md`）。

### 7. `.claude/hooks.json`

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx @riconext/hermes-repo capture"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx @riconext/hermes-repo inject"
          }
        ]
      }
    ]
  }
}
```

使用 `PACKAGE_NAME` 常量拼接 `command` 字段，避免硬编码包名漂移；格式符合 Claude Code command hook  schema。

### 8. `.gitignore` 合并策略

```gitignore
# >>> hermes-repo memory (do not edit this block manually)
# 个人层 — 不提交
.memory/captures/
.memory/sessions/
.memory/refs/
.memory/personal/

# 团队层 — 提交
!.memory/topics/
!.memory/skills/
!.memory/MEMORY.md
!.memory/MEMORY-*.md
!.memory/team/
!.memory/config.json
!.memory/templates/
# <<< hermes-repo memory
```

**算法**（`mergeGitignore(repoRoot)`）：

1. 若 `.gitignore` 不存在 → 新建并写入整块。
2. 若已有 `>>> hermes-repo memory` → 替换标记间内容（幂等更新）。
3. 否则 → 追加到文件末尾 + 前导空行。
4. 不删除用户原有规则；若已有 `.memory/` 全目录忽略，init 摘要中 warn。

**注意**：hermes-repo **自身**仓库 `.gitignore` 继续忽略 `.memory/`；与 init 写入**用户项目**的规则不同。

### 9. 可选：capture / promote 模板

| 包内路径 | 写入目标 | 默认（-y） |
|----------|----------|------------|
| `templates/capture-semantic.example.md` | `.memory/templates/` | 写入 |
| `templates/capture-episodic.example.md` | 同上 | 写入 |
| `templates/capture-procedural.example.md` | 同上 | 写入 |
| `templates/PROMOTE_PR.md` | 同上 | 写入 |

交互项：`includeExampleTemplates`（默认 true）。

### 10. 幂等与 `--force` 语义

| 场景 | 默认行为 | `--force` |
|------|----------|-----------|
| 目录不存在 | `mkdir -p` | 同左 |
| `.memory/config.json` | **始终合并写入**（created / overwritten） | 同左（不依赖 `--force`） |
| 其它脚手架文件已存在 | **跳过** | **覆盖**（白名单内） |
| `captures/**` 下已有用户 `.md` | 永不覆盖 | 永不删除 |
| `.gitignore` 标记块 | 始终 merge 更新 | 同左 |
| 第二次 `init -y` | exit 0，skipped=N | 同左 |

**检测「已初始化」**：存在 `.memory/config.json` 且 `version === 1` → 交互模式询问是否仅补全；`-y` 下静默补全。无论是否已初始化，**`config.json` 每次 init 都会按 §4 合并更新**。

**不做**：`init --scan`、`init --interview`、`clone`、任何 LLM 调用。

---

## 文件结构（本仓库新增/修改）

```text
hermes-repo/
├── package.json
├── tsup.config.ts
├── templates/
│   ├── AGENTS.md.tpl
│   ├── MEMORY.md.tpl
│   ├── config.json.tpl
│   ├── hooks.json.tpl
│   ├── gitignore-block.txt
│   ├── steward-log.md.tpl
│   ├── capture-semantic.example.md
│   ├── capture-episodic.example.md
│   ├── capture-procedural.example.md
│   └── PROMOTE_PR.md
├── src/
│   ├── cli.ts
│   ├── commands/
│   │   └── init.ts
│   └── init/
│       ├── assistants/
│       │   ├── types.ts
│       │   ├── registry.ts
│       │   ├── claude-code.ts
│       │   └── cursor.ts
│       ├── types.ts
│       ├── runInit.ts
│       ├── mergeAssistants.ts
│       ├── scaffoldWrite.ts
│       ├── paths.ts
│       ├── ensureDirs.ts
│       ├── writeScaffoldFile.ts
│       ├── mergeConfig.ts
│       ├── mergeGitignore.ts
│       ├── prompts.ts
│       └── templateDir.ts
└── tests/
    ├── cli.test.ts
    └── init.test.ts
```

### 核心函数职责

| 函数 | 文件 | 职责 |
|------|------|------|
| `runInitCommand(opts)` | `commands/init.ts` | 校验 cwd、调用 `runInit`、设置 exit code |
| `runInit(opts)` | `init/runInit.ts` | 流程编排 |
| `resolveTargetDir(cwd?)` | `init/runInit.ts` | 解析绝对路径，可选 `git rev-parse` warn |
| `gatherInitOptions(opts)` | `init/prompts.ts` | TTY 交互或 `-y` 默认 |
| `ensureMemoryTree(root)` | `init/ensureDirs.ts` | 创建目录树 + `.gitkeep` |
| `writeScaffoldFiles(root, opts)` | `init/writeScaffoldFile.ts` | 按清单写入 |
| `mergeConfigForInit(root, assistants)` | `init/mergeConfig.ts` | 创建或合并 `config.json`（每次 init 执行） |
| `mergeHermesGitignore(root)` | `init/mergeGitignore.ts` | 标记块逻辑 |
| `resolveTemplatePath(name)` | `init/templateDir.ts` | 解析 dist/templates |
| `shouldWriteFile(path, force)` | `init/writeScaffoldFile.ts` | 幂等判断 |
| `printInitReport(report)` | `init/runInit.ts` | 人类可读摘要 |

---

## 技术选型

### `@inquirer/prompts`

交互问题（v0.1 最小）：

1. 目标目录确认（默认 `.`）
2. 是否包含 capture 示例模板（默认 Yes）
3. 若已有 `config.json`：仅补全 / 取消（默认补全）

### 模板：`templates/` + build 复制

`tsup.config.ts` 在 `onSuccess` 中将 `templates` 复制到 `dist/templates`。

### 幂等策略（总结）

- 默认 skip 已存在脚手架文件（**不含** `config.json`）。
- `config.json`：每次 init 合并写入 init 管理字段（`mergeConfigForInit`）。
- `--force` 仅覆盖白名单，不碰 `captures/**/*.md`。
- 目录永远补全。
- gitignore 块始终刷新。

---

## 测试：`tests/init.test.ts`

| # | 用例名 | 断言 |
|---|--------|------|
| 1 | `init -y creates full tree` | exit 0；目录均存在；`sessions/index.json` 可解析 |
| 2 | `writes config.json v1 file backend` | `version===1`，`storage.backend==="file"`，`debug===false`，无 `mcp` |
| 2b | `second init overwrites config.json` | 二次 init 合并 `assistants` / `debug`；报告 overwritten |
| 3 | `writes hooks.json` | 含 Stop/SessionStart 与 capture/inject |
| 4 | `writes AGENTS.md with key sections` | 含 `记忆系统`、`captures`、`团队协作` |
| 5 | `writes placeholder MEMORY.md` | 含 `项目记忆`、`检索提示` |
| 6 | `merges gitignore block` | 标记块与个人/团队规则正确 |
| 7 | `idempotent second run` | 连续两次 exit 0；不破坏已有内容 |
| 8 | `non-tty requires -y` | 无 `-y` 时 exit ≠ 0 |
| 9 | `force overwrites scaffold` | `-f` 恢复模板内容 |
| 10 | `optional templates skipped` | 内部 flag 或 `runInit` 直测 |

`beforeAll` 依赖 `bun run build`；临时目录 `mkdtemp`。

---

## 验收标准（Done 定义）

1. `bun run build` 后 `dist/templates/` 与源码 `templates/` 一致。
2. 空目录 `init -y` 生成完整树 + 根级 `AGENTS.md`、`.claude/hooks.json`。
3. `config.json` 符合 v0.1 schema（仅 `file` backend）。
4. hooks 指向 `capture` / `inject`（命令未实现属预期）。
5. 项目 `.gitignore` 含 hermes-repo 标记块且规则正确。
6. 重复 `init -y` 不覆盖已有 captures。
7. CI 非 TTY：`init` 无 `-y` 失败；`init -y` 通过。
8. `bun run test` 全绿（含 `init.test.ts`）。
9. `bun run typecheck` 无错误。
10. **明确不做**：`capture`、`inject`、`consolidate`、`search`、`stats`、`promote`、LLM、`--scan`、`--interview`。

---

## 时间分配（参考，1.5–2 天）

| 时段 | 任务 |
|------|------|
| 0.5h | `templates/` 文稿、`tsup` 复制、`paths` 常量 |
| 1h | `ensureDirs` + `writeScaffoldFile` + 核心脚手架文件 |
| 0.5h | `mergeGitignore` + 幂等 / `--force` |
| 0.5h | `prompts.ts` + CLI 注册 + NON_TTY 门禁 |
| 1h | `tests/init.test.ts` + 更新 `cli.test.ts` |
| 0.5h | README 微调、样例 repo 手工验收 |

---

## 与 Phase 2 衔接

| Phase 1 交付 | Phase 2（v0.2）消费方式 |
|--------------|-------------------------|
| `.claude/hooks.json` → `capture` | 实现 `capture`：读 JSONL、过滤、写 `captures/{type}/` |
| `sessions/index.json` | capture 写入会话索引 |
| `config.json` `storage.backend: file` | 本地文件后端 |
| `captures/{semantic,episodic,procedural}/` | 直接落盘路径 |
| AGENTS.md 引导 | capture 失败时 hooks 快速 exit 0 |

**Phase 2 首项建议**：`capture` 占位（exit 0）→ 再接入 JSONL，避免 Stop hook 连续报错。

---

## 批准前确认项

1. v0.1 是否创建空的 `MEMORY-frontend.md` / `MEMORY-backend.md`？**建议：否**。
2. `init` 是否必须在 Git 仓库内？**建议：仅 warn，不阻断**。
3. hooks 包名？**建议：`npx @riconext/hermes-repo`（与设计一致）**。

---

## 实施任务清单

- [x] 依赖与 `0.1.0` 版本、`tsup` 复制 templates
- [x] `src/init/*` 模块与 `commands/init.ts`
- [x] `templates/` 全部模板文件
- [x] `tests/init.test.ts` 与 `cli.test.ts` 更新
- [x] README `init -y` / 非 TTY 说明
- [x] 验收标准 1–10 勾选
