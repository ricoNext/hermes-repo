# Memory Scope 优化文档

## 概述

将 MCP 服务中的记忆可见性从 `visibility` 重构为 `scope`，更清晰地区分个人记忆和公共记忆。

## 改动内容

### 1. 数据模型变更

**Prisma Schema (`prisma/schema.prisma`)**

```prisma
// 之前
model Memory {
  visibility Visibility @default(PRIVATE)
}

enum Visibility {
  PRIVATE  // 私有
  SHARED   // 共享
  PUBLIC   // 公共
}

// 之后
model Memory {
  scope MemoryScope @default(PERSONAL)
}

enum MemoryScope {
  PERSONAL  // 个人记忆（仅作者可见）
  TEAM      // 团队记忆（项目成员可见）
  PUBLIC    // 公共记忆（所有人可见）
}
```

**索引优化**
- 添加 `Memory_projectId_scope_idx` - 按项目和范围查询
- 添加 `Memory_authorId_scope_idx` - 查询"我的记忆"
- 添加 `Memory_projectId_type_scope_idx` - 复合筛选

### 2. API 层变更

**类型定义更新 (`src/services/memory.ts`)**

```typescript
// CreateMemoryInput
scope?: MemoryScope;  // 替代 visibility

// SearchMemoryFilters
scope?: MemoryScope;  // 支持按范围筛选

// MemoryView
scope: MemoryScope;   // 返回值包含 scope
```

**权限控制逻辑 (`src/services/memory.ts`)**

```typescript
// 查询时自动过滤权限
const scopeFilter: Prisma.MemoryWhereInput[] = [
  { scope: "PUBLIC" },                    // 所有人可见
  { scope: "TEAM" },                      // 团队成员可见
  { scope: "PERSONAL", authorId: user.id }, // 仅作者可见
];
```

**MCP Tools 更新 (`src/server.ts`)**

- `add_memory`: `visibility` → `scope`
- `search_memories`: `filters.visibility` → `filters.scope`
- `promote_memory`: `newVisibility` → `newScope`

**REST API 更新 (`src/server.ts`)**

- `GET /api/memories?scope=PERSONAL|TEAM|PUBLIC`
- `PATCH /api/memories/:id/scope` (原 `/visibility`)

### 3. 权限逻辑更新

**`src/permissions.ts`**

```typescript
// checkMemoryPermission
switch (memory.scope) {
  case "PERSONAL": return memory.authorId === user.id;
  case "TEAM": return userRole && requiredRole === "read";
  case "PUBLIC": return true;
}

// canReadMemoryInProject
- PERSONAL: 仅作者
- TEAM: 项目成员
- PUBLIC: 所有人
```

## 数据迁移

### 执行步骤

1. **备份数据**（生产环境必做）
   ```bash
   pg_dump $DATABASE_URL > backup.sql
   ```

2. **运行迁移脚本**
   ```bash
   node migrate-visibility-to-scope.cjs
   ```

3. **重新生成 Prisma Client**
   ```bash
   bun prisma generate
   ```

4. **重新构建项目**
   ```bash
   bun run build
   ```

5. **测试验证**
   ```bash
   node test-memory-scope.cjs
   ```

### 迁移脚本内容

`migrate-visibility-to-scope.cjs` 自动完成：
- 枚举类型重命名：`Visibility` → `MemoryScope`
- 枚举值映射：
  - `PRIVATE` → `PERSONAL`
  - `SHARED` → `TEAM`
  - `PUBLIC` → `PUBLIC` (不变)
- 列重命名：`visibility` → `scope`
- 索引重建

## UI 展示建议

### 记忆列表分组

```
┌─────────────────────────────────────┐
│  📂 团队记忆 (Team Memories)        │
│  ├─ Canvas 交互规范                 │
│  └─ Redux 状态管理指南              │
│                                     │
│  📝 我的记忆 (My Memories)          │
│  ├─ 个人笔记                        │
│  └─ 待办事项                        │
│                                     │
│  🌍 公共记忆 (Public Memories)      │
│  └─ TypeScript 最佳实践             │
└─────────────────────────────────────┘
```

### 筛选器

```tsx
<Select value={scope} onChange={setScope}>
  <option value="ALL">全部</option>
  <option value="PERSONAL">👤 我的记忆</option>
  <option value="TEAM">👥 团队记忆</option>
  <option value="PUBLIC">🌐 公共记忆</option>
</Select>
```

### 记忆卡片

```tsx
<MemoryCard>
  <Badge color={
    scope === 'PERSONAL' ? 'blue' :
    scope === 'TEAM' ? 'green' :
    'purple'
  }>
    {scope === 'PERSONAL' ? '👤 个人' :
     scope === 'TEAM' ? '👥 团队' :
     '🌐 公共'}
  </Badge>
  <Title>{memory.title}</Title>
  <Author>@{memory.author.name}</Author>
</MemoryCard>
```

## API 使用示例

### MCP Tool 调用

```typescript
// 创建个人记忆
await mcp.call('add_memory', {
  projectId: 'uuid',
  title: '我的笔记',
  content: '内容',
  type: 'NOTE',
  scope: 'PERSONAL',  // 仅自己可见
});

// 创建团队记忆
await mcp.call('add_memory', {
  projectId: 'uuid',
  title: 'API 规范',
  content: '团队共享',
  type: 'CONTEXT',
  scope: 'TEAM',  // 项目成员可见
});

// 搜索团队记忆
await mcp.call('search_memories', {
  projectId: 'uuid',
  query: 'API',
  filters: { scope: 'TEAM' },
});

// 提升为公共记忆
await mcp.call('promote_memory', {
  memoryId: 'uuid',
  newScope: 'PUBLIC',
});
```

### REST API 调用

```typescript
// 获取团队记忆
GET /api/memories?scope=TEAM
Headers: {
  Authorization: Bearer <token>,
  X-Project-Id: <project-id>
}

// 将个人记忆提升为团队记忆
PATCH /api/memories/:id/scope
Body: { scope: 'TEAM' }
```

## 测试验证

运行测试脚本验证功能：

```bash
node test-memory-scope.cjs
```

输出示例：
```
🧪 测试记忆范围功能...

📊 记忆统计:
  个人记忆 (PERSONAL): 3
  团队记忆 (TEAM): 7
  公共记忆 (PUBLIC): 0
  总计: 10

✅ 测试完成！
```

## 向后兼容

⚠️ **破坏性变更** - 需要更新所有客户端代码：

1. **CLI 工具** - 如果 CLI 将来推送到 MCP，需要使用 `scope` 字段
2. **UI 界面** - 前端代码需要更新字段名
3. **第三方集成** - 通知使用 MCP API 的第三方更新

## 回滚方案

如果需要回滚：

```sql
-- 回滚迁移
ALTER TABLE "Memory" RENAME COLUMN "scope" TO "visibility";
ALTER TYPE "MemoryScope" RENAME TO "Visibility";
ALTER TYPE "Visibility" RENAME VALUE 'PERSONAL' TO 'PRIVATE';
ALTER TYPE "Visibility" RENAME VALUE 'TEAM' TO 'SHARED';

-- 重建索引
DROP INDEX IF EXISTS "Memory_scope_idx";
CREATE INDEX "Memory_visibility_idx" ON "Memory"("visibility");
```

## 优势总结

✅ **语义更清晰** - `scope` 比 `visibility` 更准确描述"作用范围"  
✅ **权限更直观** - `PERSONAL/TEAM/PUBLIC` 比 `PRIVATE/SHARED/PUBLIC` 更易理解  
✅ **查询更高效** - 新增的复合索引优化了常见查询场景  
✅ **UI 友好** - 便于在界面上按范围分组展示  
✅ **扩展性强** - 未来可以轻松添加更多范围类型（如 ORGANIZATION）

## 相关文件

- `prisma/schema.prisma` - 数据模型定义
- `src/services/memory.ts` - 业务逻辑
- `src/permissions.ts` - 权限控制
- `src/server.ts` - MCP Tools 和 REST API
- `migrate-visibility-to-scope.cjs` - 迁移脚本
- `test-memory-scope.cjs` - 测试脚本
