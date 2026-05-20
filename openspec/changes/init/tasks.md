## 1. 依赖与工程

- [x] 1.1 在 `package.json` 的 `dependencies` 中加入 `commander` 与 `@inquirer/prompts`（版本选当前稳定），运行 `bun install` 更新 `bun.lock`
- [x] 1.2 确认 `tsup` 对 CLI 的打包方式仍能将运行时依赖正确解析进 `dist/cli.js`（必要时将 commander / inquirer 标为 external 或验证 bundle 体积与行为）

## 2. CLI 结构与入口

- [x] 2.1 将 `src/cli.ts` 改为使用 `commander`：程序名、版本、`--help`；注册子命令 `init`，选项 `--yes` / `-y`
- [x] 2.2 保留现有 Node 24+ 校验与 `PACKAGE_NAME` / 版本读取逻辑（或迁移到 commander 的 `.version()` / `.name()`）

## 3. init 核心逻辑

- [x] 3.1 新增模块（如 `src/init.ts` 或 `src/commands/init.ts`）：导出 `runInit(cwd, options)`，`options` 含 `yes: boolean`
- [x] 3.2 实现路径规范化与「禁止逃出 cwd」校验：对 `evolvesRoot`（及若可配置则 `captures`）使用 `path.resolve` + `relative` 检查或以 `resolved.startsWith(resolvedCwd + sep)` 判定
- [x] 3.3 实现 `mkdir -p` 于 `.hermes-repo`、`paths.captures`、`paths.evolvesRoot`
- [x] 3.4 实现白名单写入：至少 `.hermes-repo/captures/TEMPLATE.md`（内容含 front matter 占位，与后续 validate 预留对齐）；存在则覆盖
- [x] 3.5 最后写入 `.hermes-repo/config.json`：`version: 1`，`paths: { captures, evolvesRoot, metaRuleFilename }`，键名与 design 一致；`JSON.stringify` 带缩进便于人类编辑

## 4. 交互与 -y

- [x] 4.1 TTY 检测：`!process.stdin.isTTY` 且无 `-y` 时打印说明并以非零退出
- [x] 4.2 TTY 且无 `-y`：使用 `@inquirer/prompts` 依次确认 cwd（展示绝对路径）、`evolvesRoot` 默认 `.hermes-repo/specs`、`metaRuleFilename` 默认 `META.md`、覆盖 B 说明确认；可选再问 `captures` 默认 `.hermes-repo/captures`（若设计定为首版固定则可省略该问）
- [x] 4.3 `-y`：跳过全部 prompt，直接使用默认值写盘

## 5. 验证与文档

- [x] 5.1 本地手动：`bun run build` 后在临时空目录执行 `node …/dist/cli.js init -y`，检查目录树与 `config.json` 内容
- [x] 5.2（可选）添加最小自动化测试：在 `fixtures` 或 `src/**/*.test.ts` 用 `node:test` 或 vitest 调用 `runInit`（若引入测试运行器需评估 scope；可标为后续 change）— **暂缓**，后续 change 再引入 `node:test` / vitest。
- [x] 5.3 更新根 `README.md`「开发」或用法段：列出 `hermes-repo init` 与 `-y`；可选同步 `docs/evolve-npm-package.md` 中 `init` 与路径命名与本文 change 一致
