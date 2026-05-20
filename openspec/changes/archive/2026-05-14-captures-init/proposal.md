## Why

当前 `init` 将 **`paths.captures`** 固定为 `.hermes-repo/captures`，且 **`TEMPLATE.md` 写入路径与常量 `TEMPLATE_REL` 硬编码绑定**，无法在初始化时按团队习惯选择「capture 记录落点」。与已对齐的产品目标不符：**在 init 阶段选定 capture 目录，并在该目录放置模版文件，为后续 capture 记录提供统一结构**。

## What Changes

- **`hermes-repo init`（交互模式）**：在现有 cwd / evolvesRoot / meta / 覆盖确认流程中，**增加一步**：由用户输入 **capture 记录目录**（相对项目根），默认仍为 **`.hermes-repo/captures`**；路径须通过既有 **「不得逃出 cwd」** 校验。
- **`hermes-repo init -y`**：继续使用 **默认** `paths.captures`（`.hermes-repo/captures`），行为与现网一致。
- **模版文件**：**始终**写入 **`{paths.captures}/TEMPLATE.md`**（文件名固定）；内容沿用当前 front matter + 正文骨架；**覆盖策略 B** 对该白名单文件仍然适用。
- **`config.json`**：`paths.captures` 写入用户选定（或默认）的**相对路径**（POSIX `/`），与 `writeTemplate` 实际落盘路径一致。
- **实现重构**：移除 `TEMPLATE_REL` 与 `DEFAULT_CAPTURES` 的硬编码耦合；成功消息中打印的模版路径随 `paths.captures` 动态展示。

## Capabilities

### New Capabilities

- `captures-scaffold`：通过 `init` 配置 capture 落点目录并在该目录提供 `TEMPLATE.md`，同步 `config.json` 的 `paths.captures`。

### Modified Capabilities

- （无）仓库根 `openspec/specs/` 下尚无已归档基线 spec；与 `init` 相关的历史 change `init` 已 complete，本 change 以新能力 `captures-scaffold` 描述增量行为。

## Impact

- **`src/init.ts`**：`collectPathsInteractive`、`defaultPaths`、`writeTemplate`、stdout 文案。
- **`README.md` / `docs/evolve-npm-package.md`**（可选）：补充「init 可选 capture 目录」一句说明。
- **无**新依赖；**无** CLI 子命令变更（仍仅 `init`）。
