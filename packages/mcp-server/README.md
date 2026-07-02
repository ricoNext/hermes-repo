# @riconext/hermes-mcp-server

团队记忆 **MCP 服务器**，基于 FastMCP + PostgreSQL。

## 能力

- **MCP 工具**：`list_projects`、`add_memory`、`search_memories`、`promote_memory`、`delete_memory`
- **REST API**：供 `@riconext/hermes-ui` 管理项目与记忆
- **认证**：JWT（开发模式可 `DEV_AUTH_BYPASS=true` 跳过）
- **检索**：关键词搜索（标题 + 内容）

## 快速开始

### 1. 启动数据库

在仓库根目录：

```bash
docker compose up -d
```

### 2. 配置环境变量

```bash
cd packages/mcp-server
cp .env.example .env
```

### 3. 初始化数据库

```bash
bun run db:push
bun run db:seed
```

默认超管账号：`admin` / `admin`（角色：SUPER_ADMIN）

### 4. 启动服务

```bash
# 仓库根目录
bun run dev:mcp

# 或本包目录
bun run dev
```

- MCP / REST：`http://localhost:3000`
- 健康检查：`http://localhost:3000/health`

## MCP 传输

| 模式 | 环境变量 | 说明 |
|------|----------|------|
| HTTP Stream | `MCP_TRANSPORT=httpStream`（默认） | 本地开发与 UI 联调 |
| stdio | `MCP_TRANSPORT=stdio` | Claude Code / Cursor 本地接入 |

## 设计文档

详见 `docs/plans/2026-06-30-team-memory-mcp-system-design.md`。
