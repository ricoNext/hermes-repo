# Packages

本 monorepo 按团队记忆系统设计方案拆分：

| 包 | 说明 | 状态 |
| --- | --- | --- |
| `@riconext/hermes-repo` | CLI / hooks / 本地 `.memory/` 工作流 | 已实现 |
| `@riconext/hermes-mcp-server` | MCP 记忆服务器（FastMCP + PostgreSQL） | 占位 |
| `@riconext/hermes-ui` | 团队记忆 Web 管理平台 | 占位 |

```text
packages/
├── cli/          # 现有 npm 发布包
├── mcp-server/   # MCP 服务（第一阶段）
└── ui/           # 管理界面（第二阶段）
```
