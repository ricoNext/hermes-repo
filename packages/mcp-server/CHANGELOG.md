# @riconext/hermes-mcp-server

## 0.2.0

### Minor Changes

- refactor: 将 MCP 认证从 apiKey 改为 userId

  **Breaking Changes:**

  - MCP 配置中的 `apiKey` 字段改为 `userId`
  - 需要重新运行 `hermes-repo init` 配置 MCP 用户 ID

  **CLI 变更:**

  - `McpConfig.apiKey` → `McpConfig.userId`
  - init 命令提示输入用户 ID（UUID 格式）而非 API Key
  - 新增 `isValidUserId()` 校验函数

  **客户端变更:**

  - 使用 `X-User-Id` header 替代 `Authorization: Bearer <token>`
  - 客户端配置参数从 `apiKey` 改为 `userId`

  **服务端变更:**

  - `resolveRestSession()` 直接通过 `X-User-Id` header 查询用户
  - 移除 JWT token 认证逻辑（仅针对记忆推送/拉取）
  - CORS 配置新增 `X-User-Id` header 支持

  **迁移指南:**

  1. 更新到新版本后，编辑 `.memory/config.json`
  2. 将 `storage.mcp.apiKey` 改为 `storage.mcp.userId`
  3. 填入 MCP 服务器中的用户 ID（可从 UI 获取）
  4. 或重新运行 `npx @riconext/hermes-repo init` 重新配置
