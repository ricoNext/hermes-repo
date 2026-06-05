# Changesets

本仓库使用 [Changesets](https://github.com/changesets/changesets) 维护版本号与 `CHANGELOG.md`。

## 日常（有用户可见改动时）

```bash
bun run changeset
```

按提示选择 **patch / minor / major**，并写一句变更说明（会进入 CHANGELOG）。将生成的 `.changeset/*.md` 与代码一起提交。

## 发版前（准备打 tag / 触发 npm 前）

```bash
bun run changeset:version
```

该命令会：

- 根据已合并的 changeset 文件提升 `package.json` 中的 `version`；
- 调用 `@changesets/changelog-github` 更新根目录 `CHANGELOG.md`；
- 删除已被消费的 `.changeset/*.md`。

然后提交版本与 Changelog 的改动，推送后按既有流程打 tag（如 `v0.14.0`）以触发 GitHub Actions 发布 npm。

## 说明

- `commit: false`：不会在本地替你 `git commit`，便于你在 CI 或 PR 里审阅 diff。
- 若仓库重命名，请同步修改 `.changeset/config.json` 中的 `repo` 字段。
