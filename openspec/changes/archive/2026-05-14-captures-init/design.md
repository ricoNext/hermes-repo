## Context

- `runInit` 已支持 `paths.evolvesRoot`、`paths.metaRuleFilename` 的交互收集；**`paths.captures` 仍为常量** `DEFAULT_CAPTURES`。
- `writeTemplate` 使用常量 `TEMPLATE_REL`，与 `paths.captures` 解耦失败会导致配置与磁盘不一致。
- 产品约定：**init 时选定 capture 落点**，并在该目录写入 **`TEMPLATE.md`**，供后续人工或未来 CLI 新增 capture 记录时复用结构。

## Goals / Non-Goals

**Goals:**

- 交互式 `init` 询问 **capture 目录**（默认 `.hermes-repo/captures`），校验路径在 cwd 内。
- **`TEMPLATE.md`** 写入 **`resolve(cwd, paths.captures)/TEMPLATE.md`**，并在 **`config.json`** 中写入同一 `paths.captures` 字符串（POSIX）。
- **`-y`**：不新增提问，`paths.captures` 取默认值。
- 更新覆盖确认文案：指明 **「config + `{paths.captures}/TEMPLATE.md`」** 的白名单覆盖（策略 B 不变）。

**Non-Goals:**

- **`capture new` / `validate` / `affected-docs` 仅 evolvesRoot** 等后续能力（另开 change）。
- 模版文件名可配置、多模版、示例 `capture-*.md` 预生成。

## Decisions

1. **模版路径**：固定 **`{paths.captures}/TEMPLATE.md`**，不因目录深度改名。  
   - **理由**：简单、与现有 B 策略一致；后续若要可配置再 semver。  
   - **备选**：`paths.captureTemplate` 单独键 — 本期不做。

2. **交互顺序**：在 **evolvesRoot** 之前还是之后询问 **captures**？  
   - **建议**：**先问 captures，再问 evolvesRoot，再问 meta，最后覆盖确认**（由浅入深：先定「经验放哪」再定「规范放哪」）；或 **captures 紧跟 cwd 确认之后** 亦可。  
   - **定案**：放在 **cwd 确认之后、evolvesRoot 之前**，与「先落工具数据再落 specs」叙事一致。

3. **`writeTemplate(cwd, paths.captures)` 签名**：传入 **相对 posix 字符串**，内部 `resolve` + `mkdirp` + `writeFile`。  
   - **理由**：单一事实来源，删除 `TEMPLATE_REL` 常量。

4. **stdout 成功摘要**：打印 **`paths.captures` 下的 TEMPLATE 相对路径**（`${paths.captures}/TEMPLATE.md`），不再写死 `.hermes-repo/captures/...`。

## Risks / Trade-offs

- **[Risk]** 用户将 captures 选在 **`.hermes-repo` 外`**（如 `docs/captures`）— 仍合法，但 `.hermes-repo/config.json` 与 capture 目录分离 → **Mitigation**：文档说明即可；`validate` 未来统一读 config。  
- **[Risk]** 覆盖确认文案若仍写「captures/TEMPLATE.md」易误导 → **Mitigation**：改为动态描述或写「配置中的 captures 目录下的 TEMPLATE.md」。

## Migration Plan

- 对已 `init -y` 的仓库：**无迁移**；重新交互 `init` 可选新 captures 路径会覆盖 config 与模版（策略 B）。  
- 无数据库、无远程。

## Open Questions

- **无**（模版文件名固定 `TEMPLATE.md` 已在 Non-Goals 钉死）。
