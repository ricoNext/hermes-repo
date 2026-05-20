## ADDED Requirements

### Requirement: Init 子命令存在且可从 bin 调用

CLI SHALL 提供子命令 `init`，使得用户通过已安装的 `hermes-repo` 或 `hr`（若 package.json 已配置）可调用 `hermes-repo init` 与等价的 `hr init`。

#### Scenario: 显示帮助包含 init

- **WHEN** 用户执行 `hermes-repo --help` 或 `hermes-repo -h`
- **THEN** 帮助文本中 MUST 列出 `init` 子命令及其用途说明

#### Scenario: 调用 init 子命令

- **WHEN** 用户执行 `hermes-repo init`（可带 `--yes`）
- **THEN** 程序 MUST 进入 init 流程且不以「未知命令」退出

---

### Requirement: 项目根与配置格式

init SHALL 将 **`process.cwd()`** 视为宿主项目根；生成的配置 MUST 仅写入 **`.hermes-repo/config.json`**（JSON），不得依赖 YAML 或其它文件名作为配置源。

#### Scenario: 写入 config.json

- **WHEN** init 成功完成
- **THEN** 存在文件 `.hermes-repo/config.json`，且为合法 JSON，且包含至少 `version` 与 `paths` 对象，其中 `paths` MUST 包含 `evolvesRoot`、`captures` 与 `metaRuleFilename` 键（值由交互或 `-y` 默认值决定）

---

### Requirement: 默认路径与覆盖策略 B

在未通过交互修改对应字段且使用 `-y` 默认时，**`paths.evolvesRoot`** MUST 默认为 **`.hermes-repo/specs`**；**`paths.captures`** MUST 默认为 **`.hermes-repo/captures`**（除非设计/任务另有明确固定策略）。init MUST 应用**覆盖策略 B**：每次成功执行 MUST 重写 `.hermes-repo/config.json` 与白名单内模板文件；MUST NOT 删除用户在白名单目录外或白名单未列出的用户自有文件。

#### Scenario: 覆盖 config 与模板

- **WHEN** 目标仓库已存在 `.hermes-repo/config.json` 与 `.hermes-repo/captures/TEMPLATE.md`，且用户再次运行 init 并完成确认（或 `-y`）
- **THEN** 上述两文件内容 MUST 被更新为本次 init 生成内容

#### Scenario: 保留用户自建 capture

- **WHEN** `.hermes-repo/captures/` 下除 `TEMPLATE.md` 外已存在用户文件 `foo.md`，用户运行 init 并完成确认（或 `-y`）
- **THEN** `foo.md` MUST 仍存在且内容不被 init 修改

---

### Requirement: 交互与 -y 行为

当 **stdin 为 TTY** 且 **未传入 `--yes` / `-y`** 时，init MUST 使用 **@inquirer/prompts** 以交互方式确认 cwd、关键路径（至少包括 evolves 根与 meta 规则文件名）及覆盖策略说明；当 **stdin 非 TTY** 且未传入 `-y` 时，程序 MUST 以非零退出码退出并提示使用 `-y` 或在有 TTY 的环境运行。传入 **`-y` / `--yes`** 时，init MUST 跳过所有交互并采用约定默认值完成写盘。

#### Scenario: 非 TTY 无 -y 失败

- **WHEN** 标准输入不是 TTY 且命令为 `hermes-repo init`（无 `-y`）
- **THEN** 进程 MUST 以非零退出码结束且 stderr 或 stdout 中包含对 `-y` 的说明

#### Scenario: -y 无交互成功

- **WHEN** 用户在任意 cwd 执行 `hermes-repo init -y`
- **THEN** 进程 MUST 不在 stdin 上读取交互问题且以零退出码完成（在无其它错误前提下）

---

### Requirement: 目录与模板白名单

init MUST 使用 `mkdir -p` 创建 `paths.captures` 与 `paths.evolvesRoot` 所指目录（及 `.hermes-repo` 若需要）。init MUST 写入或覆盖白名单中的模板文件；初版白名单 MUST 至少包含 **`.hermes-repo/captures/TEMPLATE.md`**。

#### Scenario: 创建目录与模板

- **WHEN** 用户在空目录运行 `hermes-repo init -y`
- **THEN** MUST 存在目录 `.hermes-repo/captures` 与默认的 `paths.evolvesRoot` 目录，且 MUST 存在 `.hermes-repo/captures/TEMPLATE.md`

---

### Requirement: 依赖与解析

实现 MUST 使用 **commander** 注册子命令与选项（含 `--yes` / `-y`），MUST 将 **commander** 与 **@inquirer/prompts** 声明为 **dependencies**（非仅 devDependencies）。路径解析 MUST 拒绝解析后逃出 `process.cwd()` 的路径（例如含过多 `..` 的输入）。

#### Scenario: 恶意路径被拒绝

- **WHEN** 用户在交互中将 evolves 根设为 `../../../etc` 或等价逃逸路径
- **THEN** init MUST 以错误退出且不写入破坏性路径到 config
