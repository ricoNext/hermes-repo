## Why

`hermes-repo` 已具备可发布的 CLI 壳，但缺少在宿主仓库中落地「Hermes 式仓库级约定」的入口。没有 `init`，用户无法一键得到标准目录、配置与捕获模板，后续 `validate` / `doctor` 也无从对齐同一套契约。

## What Changes

- 新增子命令 **`hermes-repo init`**（及别名 **`hr init`**，若 bin 已配置）。
- 使用 **`commander`** 解析子命令；使用 **`@inquirer/prompts`** 在 **TTY** 下以交互方式确认项目根、可进化文档根、captures 路径、元规则文件名等；提供 **`--yes` / `-y`** 在非 TTY 或脚本场景跳过提问并采用默认值。
- 在 **`process.cwd()`** 下创建/维护 **`.hermes-repo/`** 树：写入 **`.hermes-repo/config.json`（仅此格式）**、**captures** 目录、默认可进化根 **`.hermes-repo/specs`**（可通过交互改为相对 cwd 的其它路径并写入配置）。
- **覆盖策略 B**：每次 init **重写** `config.json` 与**工具模板白名单**（如 `captures/TEMPLATE.md`）；**不删除**用户已在 `captures/` 或可进化根下自行创建的其它文件。
- **不实现 preset**；首版配置形态固定为文档与设计中约定的一组默认值 + 交互覆盖项。
- 新增依赖：`commander`、`@inquirer/prompts`（实现为 **dependencies**，因 CLI 运行时必需）。

## Capabilities

### New Capabilities

- `cli-init`：在宿主仓库当前工作目录初始化 `.hermes-repo` 布局、生成 `config.json` 与捕获模板，并通过交互或 `-y` 确认路径与覆盖说明。

### Modified Capabilities

- （无）仓库内尚无已发布的 `openspec/specs/` 能力基线。

## Impact

- **`src/cli.ts`**：从手写 argv 迁移为 commander 子命令结构；保留 Node 版本门槛与 `--version` / `--help` 行为。
- **`package.json`**：新增运行时依赖；`prepublishOnly` 仍通过 `bun run build` 触发构建。
- **`docs/evolve-npm-package.md`**（可选同步）：将原 `evolve`/YAML 等过时默认与 `init` 行为对齐为 `.hermes-repo`、`config.json`、交互与覆盖 B，避免文档与实现分叉（可在 apply 阶段或单独 PR 处理）。
