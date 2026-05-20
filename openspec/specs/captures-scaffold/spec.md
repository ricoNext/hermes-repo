# captures-scaffold Specification

## Purpose
TBD - created by archiving change captures-init. Update Purpose after archive.
## Requirements
### Requirement: Init 交互须收集 capture 落点目录

在 **stdin 为 TTY** 且用户未使用 **`--yes` / `-y`** 时，`hermes-repo init` SHALL 使用 `@inquirer/prompts` 的 **`input`**（或等价控件）提示用户输入 **capture 记录目录**，该路径为 **相对当前工作目录（`process.cwd()`）** 的相对路径；**默认值** SHALL 为 **`.hermes-repo/captures`**。用户输入 SHALL 经 **`assertPathInsideCwd`**（或等价逻辑）校验，不得逃出项目根。

#### Scenario: 交互中采用默认 captures 路径

- **WHEN** 用户在 TTY 下运行 `hermes-repo init` 且在 capture 目录提示处直接接受默认值
- **THEN** 生成的 `config.json` 中 **`paths.captures`** MUST 为 **`.hermes-repo/captures`**（POSIX 字符串）

#### Scenario: 交互中自定义 captures 路径

- **WHEN** 用户在 TTY 下将 capture 目录输入为 **`docs/team-captures`**（位于项目根内）
- **THEN** 生成的 `config.json` 中 **`paths.captures`** MUST 记录为该相对路径（规范化后为 POSIX 风格），且 **`TEMPLATE.md`** MUST 写入 **`docs/team-captures/TEMPLATE.md`**（相对项目根的等效路径）

---

### Requirement: Init 非交互保持默认 captures

当用户使用 **`hermes-repo init -y`**（或 **`--yes`**）时，程序 SHALL **不**就 capture 目录提出额外问题；**`paths.captures`** SHALL 取默认 **`.hermes-repo/captures`**，与当前非交互行为一致。

#### Scenario: -y 不写自定义 captures

- **WHEN** 用户在新目录执行 `hermes-repo init -y`
- **THEN** **`paths.captures`** MUST 为 **`.hermes-repo/captures`**，且 **`TEMPLATE.md`** MUST 存在于该目录下

---

### Requirement: 模版文件位置与 config 一致

`init` SHALL 将 capture 模版写入 **`{paths.captures}/TEMPLATE.md`**（`paths.captures` 为 `config.json` 内最终值；`TEMPLATE.md` 为固定文件名）。每次成功 init 对该文件应用**覆盖策略 B**（存在则重写）。程序 SHALL **不得**将模版写在与 **`config.paths.captures`** 不一致的路径。

#### Scenario: 模版随 captures 路径移动

- **WHEN** `paths.captures` 为 **`journal/captures`**
- **THEN** 文件 **`journal/captures/TEMPLATE.md`** MUST 被创建或覆盖，且 **不得**在 **`.hermes-repo/captures/TEMPLATE.md`** 再写一份（除非该路径与 `journal/captures` 相同）

---

### Requirement: 覆盖确认文案须反映真实模版路径

交互流程中最终确认「覆盖策略 B」的文案 SHALL **体现**实际 **`paths.captures`** 下的 **`TEMPLATE.md`** 相对路径（或明确说明「配置中的 captures 目录下的 TEMPLATE.md」），不得硬编码为仅适用于 **`.hermes-repo/captures`** 的措辞（当用户选择其它目录时不得产生误导）。

#### Scenario: 自定义目录下的确认文案

- **WHEN** 用户将 captures 设为 **`docs/cap`**
- **THEN** 覆盖确认提示中 MUST 包含 **`docs/cap/TEMPLATE.md`** 或等价的明确指称

