## Context

- 包：`@riconext/hermes-repo`，入口 `src/cli.ts`，构建产物 `dist/cli.js`，运行时要求 Node **24+**。
- 宿主侧「项目根」定义为 **`process.cwd()`**（不解析 git root）。
- 配置唯一落点：**`.hermes-repo/config.json`**（仅 JSON）。
- 默认可进化文档根：**`.hermes-repo/specs`**（可经交互改为相对 cwd 的路径并写入 `paths.evolvesRoot`）。
- 捕获目录默认：**`.hermes-repo/captures`**（若交互支持可配置则写入 `paths.captures`，否则固定该路径仍写入 config 以便后续命令一致读取）。
- 覆盖策略 **B**：重写 `config.json` + 模板白名单；不删除用户其它文件。
- 交互栈：**commander** + **@inquirer/prompts**；支持 **`-y` / `--yes`** 非交互。

## Goals / Non-Goals

**Goals:**

- 提供稳定、可测试的 **`init`** 子命令与清晰 stdout/stderr 输出。
- 在 TTY 下用交互收集路径与确认；非 TTY 或 `-y` 下零提问、可脚本化。
- 生成最小 **`config.json` schema（version + paths）**，供后续 `validate`/`doctor` 读取。
- 模板文件通过**白名单**覆盖，避免误伤用户自增内容。

**Non-Goals:**

- **preset**、多格式配置（YAML）、`git rev-parse` 根目录推断。
- `validate` / `doctor` / `capture new` 本体（可在后续 change 实现）。
- JSON Schema 对外发布子路径导出（可后续 change）。

## Decisions

1. **CLI 框架：commander**  
   - **理由**：子命令与全局选项成熟、生态常见。  
   - **备选**：`cac`（更轻）——团队已选定 commander，保持一致。

2. **交互：@inquirer/prompts**  
   - **理由**：与 commander 解耦、API 现代；`confirm` / `input` 覆盖需求。  
   - **备选**：`prompts`——功能类似，已选定 inquirer 系。

3. **非 TTY：要求 `-y` 或退出**  
   - **理由**：避免管道/CI 挂死在 stdin。  
   - **备选**：默认全静默采用默认值——易在错误 cwd 静默写盘，不采纳。

4. **配置路径解析：所有 `paths.*` 相对 `process.cwd()`**  
   - **理由**：与用户「项目根 = cwd」一致，链接校验未来可复用同一规则。  
   - **备选**：相对 `.hermes-repo`——增加心智负担，不采纳。

5. **模板白名单（初版）**  
   - **必须覆盖（存在则重写）**：`.hermes-repo/config.json`、`.hermes-repo/captures/TEMPLATE.md`。  
   - **目录**：`mkdir -p` 于 `paths.captures`、`paths.evolvesRoot`、`.hermes-repo`；**不**对 evolves 根做递归删除。  
   - **可选**：在 `specs` 根下放 `README.md` 占位——若放，须列入白名单或永不覆盖用户同名文件；**初版建议不放**或仅 `TEMPLATE.md`，减少与用户 `README.md` 冲突。

6. **写入顺序**  
   - 先 `mkdir -p`，再写模板，最后写 **`config.json`**（避免中途失败留下「半配置」被其它命令误读）；若采用临时文件 + rename，可在 tasks 中细化。

7. **依赖归类**  
   - `commander` 与 `@inquirer/prompts` 放入 **`dependencies`**（CLI 运行时加载），非 `devDependencies`。

## Risks / Trade-offs

- **[Risk] 用户在错误 cwd 运行 init** → **Mitigation**：交互第一步 `confirm` 展示绝对路径；文档强调在仓库根执行；`-y` 仍写入 cwd。  
- **[Risk] 路径含 `..` 逃出仓库** → **Mitigation**：规范化后须仍位于 `resolve(cwd, path)` 之下，否则拒绝。  
- **[Risk] ESM 与 commander/inquirer 的导入方式** → **Mitigation**：统一 `import`，`init` action 为 `async`；构建保持 `format: esm`。  
- **[Trade-off] 仅 JSON 配置** → 人类可读性弱于 YAML；与「只支持 config.json」产品决策一致。

## Migration Plan

- 无线上迁移：首版能力。已手写 `.evolve` 旧目录的宿主不在本 change 范围内（文档可另述迁移指南）。

## Open Questions

- **`paths.captures` 是否在首版交互中可改**：若否，config 仍写死 `.hermes-repo/captures` 亦可；建议 **首版交互只问 evolvesRoot + metaRuleFilename**，captures 固定，减少变量。  
- **`TEMPLATE.md`  front matter 字段集合**：与将来 `validate` schema 对齐的任务可放在 `tasks.md` 或后续 spec 增补。
