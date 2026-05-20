# hermes-repo
Hermes-repo 是面向任意 Git 仓库的命令行工具，将 Hermes 式「经验 → 技能 → 自改进」学习闭环映射到文档与团队约定：通过 `hermes-repo init` 在**当前目录**生成 `.hermes-repo/config.json`、默认可进化根、**可配置的 capture 目录**及该目录下的 **`TEMPLATE.md`**；`validate` / `doctor` 等能力持续迭代中。无服务端、不替代 IDE 里的 AI；演进经 Pull Request，由人审批。主打「Hermes 能力装进 repo」——可挂 CI、跨栈复用，适合希望统一「踩坑有记录、契约能升级、对外能讲清 Hermes 式闭环」的研发与平台团队。

## 用法（安装后）

- **`hermes-repo init`**：交互式确认项目根、**capture 记录目录**（默认 `.hermes-repo/captures`）、可进化文档根等（需在 TTY 下运行）。
- **`hermes-repo init -y`**：非交互，使用默认路径（适合 CI 或脚本）。
- **`hermes-repo --help`**：查看子命令与选项。

## 开发

本仓库使用 **Bun** 管理依赖与脚本（不提交 `package-lock.json`；锁文件为 `bun.lock`）。

- **要求**：Bun 版本与 `package.json` 中的 `packageManager` 字段一致；**Node.js 24+**（与 `engines` 及已发布 CLI 运行时一致）。
- **常用命令**：`bun install`、`bun run build`、`bun run typecheck`、`bun run dev`。
- **发布**：`bun publish`（`prepublishOnly` 会先执行 `bun run build`）。
