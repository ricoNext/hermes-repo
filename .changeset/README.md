# Changesets

本仓库使用 [Changesets](https://github.com/changesets/changesets) 维护版本号与 `CHANGELOG.md`。

## 日常（有用户可见改动时）

```bash
bun run changeset
```

按提示选择 **patch / minor / major**，并写一句变更说明（会进入 CHANGELOG）。将生成的 `.changeset/*.md` 与代码一起提交。

## 发版

```bash
bun run release
```

该命令会：

- 根据已合并的 changeset 文件提升 `package.json` 中的 `version`；
- 调用 Changesets 本地 changelog 生成器更新根目录 `CHANGELOG.md`；
- 删除已被消费的 `.changeset/*.md`；
- 同步 `bun.lock`；
- 执行 typecheck 与测试；
- 提交版本变更；
- 创建与版本一致的本地 tag（如 `v0.14.0`）；
- 推送当前分支与 tag 到远端。

远端 GitHub Actions 只监听 `v*` tag，并执行 npm publish。

## 说明

- `commit: false`：不会在本地替你 `git commit`，便于你在 CI 或 PR 里审阅 diff。
- changelog 生成不依赖 GitHub token，适合本地 release 流程。
