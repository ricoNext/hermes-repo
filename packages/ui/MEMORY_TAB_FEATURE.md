# UI 记忆列表 Tab 分组功能

## 概述

记忆列表现在使用 Tab 分组展示，将个人记忆和共享记忆分开显示，提供更清晰的界面体验。

## Tab 结构

### 1. **全部** (All)
显示所有用户可见的记忆，包括：
- 个人记忆（PERSONAL）
- 团队记忆（TEAM）
- 公共记忆（PUBLIC）

### 2. **👤 我的记忆** (Personal)
仅显示当前用户创建的个人记忆（`scope: PERSONAL`）
- 只有作者本人可见
- 适合存放个人笔记、临时想法

### 3. **👥 共享记忆** (Team)
显示团队共享和公共记忆，分为两个子分组：
- **👥 团队记忆** (`scope: TEAM`) - 项目成员可见
- **🌍 公共记忆** (`scope: PUBLIC`) - 所有人可见

## 界面特性

### Tab 计数
每个 Tab 显示该分类下的记忆数量：
```
全部 (10) | 👤 我的记忆 (3) | 👥 共享记忆 (7)
```

### 记忆卡片 Badge
每条记忆显示范围标识：
- `👤 个人` - 蓝色 secondary badge
- `👥 团队` - 默认 default badge
- `🌍 公共` - 灰色 outline badge

### 筛选器
在 Tab 下方提供：
- **搜索框** - 按标题和内容搜索
- **类型筛选** - NOTE/CONTEXT/PREFERENCE/SNIPPET
- 筛选器对所有 Tab 生效

### 操作菜单
每条记忆的右上角下拉菜单提供：
- **升级范围** - 将个人记忆升级为团队/公共
  - PERSONAL → TEAM 或 PUBLIC
  - TEAM → PUBLIC
- **删除** - 删除记忆

## 权限逻辑

### 个人记忆 (PERSONAL)
- ✅ 仅作者可见
- ✅ 仅作者可编辑/删除
- ✅ 作者可升级为团队/公共

### 团队记忆 (TEAM)
- ✅ 项目成员可见
- ✅ 作者或管理员可编辑/删除
- ✅ 可升级为公共

### 公共记忆 (PUBLIC)
- ✅ 所有人可见
- ✅ 作者或管理员可编辑/删除
- ❌ 无法降级

## 数据分组实现

```typescript
// 按 scope 分组
const groupedMemories = useMemo(() => {
  if (!memories) return { personal: [], team: [], public: [] };

  return {
    personal: memories.filter(
      (m) => m.scope === "PERSONAL" && m.author.id === currentUser?.id
    ),
    team: memories.filter((m) => m.scope === "TEAM"),
    public: memories.filter((m) => m.scope === "PUBLIC"),
  };
}, [memories, currentUser?.id]);

// 根据 Tab 过滤
const filteredMemories = useMemo(() => {
  if (activeTab === "personal") {
    return groupedMemories.personal;
  }
  if (activeTab === "team") {
    return [...groupedMemories.team, ...groupedMemories.public];
  }
  return [...groupedMemories.personal, ...groupedMemories.team, ...groupedMemories.public];
}, [activeTab, groupedMemories]);
```

## API 更新

### 类型定义
```typescript
// src/lib/api/types.ts
export type MemoryScope = "PERSONAL" | "TEAM" | "PUBLIC";

export interface Memory {
  scope: MemoryScope;  // 替代 visibility
  tags: string[];      // 新增标签字段
  // ...
}
```

### API 方法
```typescript
// src/lib/api/memories.ts
searchMemories(projectId, { scope: "TEAM" })
promoteMemory(projectId, memoryId, "PUBLIC")
deleteMemory(projectId, memoryId)
```

## 组件结构

```
MemoryExplorer.tsx (主容器)
├─ Tabs (分组容器)
│  ├─ TabsList (Tab 头部)
│  │  ├─ TabsTrigger: "全部"
│  │  ├─ TabsTrigger: "👤 我的记忆"
│  │  └─ TabsTrigger: "👥 共享记忆"
│  │
│  ├─ 筛选器区域
│  │  ├─ Input (搜索)
│  │  └─ Select (类型筛选)
│  │
│  ├─ TabsContent: "all"
│  │  └─ MemoryCard[] (所有记忆)
│  │
│  ├─ TabsContent: "personal"
│  │  └─ MemoryCard[] (个人记忆)
│  │
│  └─ TabsContent: "team"
│     ├─ 👥 团队记忆
│     │  └─ MemoryCard[] (TEAM)
│     └─ 🌍 公共记忆
│        └─ MemoryCard[] (PUBLIC)
│
└─ CreateMemoryDialog (创建按钮)
```

## 视觉设计

### Tab 样式
- 默认：灰色底色，圆角
- 选中：白色底色（亮色模式）/ 深色底色（暗色模式）
- 悬停：轻微背景色变化

### 记忆卡片
- 白色卡片，圆角边框
- Scope Badge 在标题下方左侧
- 右上角操作菜单
- 底部显示作者头像和更新时间

### 空状态
每个 Tab 的空状态提示：
- **全部**: "暂无记忆"
- **我的记忆**: "暂无个人记忆"
- **共享记忆**: "暂无共享记忆"

## 用户体验优化

### 默认选中
首次进入默认选中 "全部" Tab

### 状态保持
切换 Tab 时保持：
- ✅ 搜索关键词
- ✅ 类型筛选
- ✅ 加载状态

### 响应式设计
- 移动端：Tab 全宽，筛选器纵向排列
- 桌面端：Tab 固定宽度，筛选器横向排列

### 加载状态
- 初次加载：显示 "加载中..."
- 切换 Tab：保持现有数据，无需重新加载

## 开发注意事项

### 依赖组件
确保已安装 shadcn/ui tabs 组件：
```bash
npx shadcn@latest add tabs
```

### 类型安全
所有 `Visibility` 类型已更新为 `MemoryScope`：
- ✅ `src/lib/api/types.ts`
- ✅ `src/lib/api/memories.ts`
- ✅ `src/components/memories/MemoryCard.tsx`
- ✅ `src/components/memories/MemoryExplorer.tsx`

### 后端兼容
确保 MCP 服务已完成迁移：
- ✅ Prisma schema 更新
- ✅ API 端点更新（`/api/memories/:id/scope`）
- ✅ 权限逻辑更新

## 未来改进

### 可能的增强功能
- [ ] Tab 可配置（用户自定义显示哪些 Tab）
- [ ] 记忆拖拽排序
- [ ] 批量操作（多选、批量升级范围）
- [ ] 记忆搜索高亮
- [ ] 标签云筛选
- [ ] 按作者筛选
- [ ] 按重要性排序

### 性能优化
- [ ] 虚拟滚动（大量记忆时）
- [ ] 分页加载
- [ ] 搜索防抖优化

## 相关文件

### 前端
- `src/components/memories/MemoryExplorer.tsx` - 主容器组件
- `src/components/memories/MemoryCard.tsx` - 记忆卡片组件
- `src/lib/api/types.ts` - 类型定义
- `src/lib/api/memories.ts` - API 方法

### 后端
- `packages/mcp-server/prisma/schema.prisma` - 数据模型
- `packages/mcp-server/src/services/memory.ts` - 业务逻辑
- `packages/mcp-server/src/server.ts` - API 路由

### 文档
- `packages/mcp-server/MEMORY_SCOPE_MIGRATION.md` - 后端迁移文档
