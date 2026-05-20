## 1. `src/init.ts` 行为

- [x] 1.1 将 `writeTemplate` 改为接收 **`cwd` + `paths.captures`**，写入 **`${paths.captures}/TEMPLATE.md`**（POSIX 拼接），删除对常量 **`TEMPLATE_REL`** 的依赖
- [x] 1.2 在 **`collectPathsInteractive`** 中，于 cwd 确认之后、evolvesRoot 之前，增加 **`input`** 询问 capture 目录，默认 **`DEFAULT_CAPTURES`**，结果经 **`assertPathInsideCwd`** 后写入返回对象的 **`captures`**
- [x] 1.3 更新 **覆盖策略 B** 的 **`confirm`** 文案：动态包含 **`${paths.captures}/TEMPLATE.md`**（在 collects 顺序上可在用户输入 captures 后暂存变量，或在最终 confirm 前拼接）
- [x] 1.4 更新成功 **`stdout`**：列出实际 **`config.json`**、**`${paths.captures}/TEMPLATE.md`**` 与目录，不再硬编码 `.hermes-repo/captures` 字符串
- [x] 1.5 修正 cwd 确认提示中的笔误：将 **`.\n${absCwd}`** 改为 **`${absCwd}`**（或 **`\n${absCwd}`**），避免输出错误前缀

## 2. 验证与文档

- [x] 2.1 **手动**：`bun run build` 后于临时目录分别验证 **`init -y`**（默认 captures）与 **TTY 下自定义 captures 路径**（如 `docs/cap`）后 `config.json` 与 `TEMPLATE.md` 位置一致（**说明**：管道 stdin 非 TTY，交互路径需在本地真实终端中试 `hermes-repo init`；`init -y` 已在 CI 式命令下验证通过。）
- [x] 2.2 更新 **`README.md`**「用法」一句：说明交互 init 可配置 **capture 目录**；可选同步 **`docs/evolve-npm-package.md`** 中与 init/captures 相关的描述
