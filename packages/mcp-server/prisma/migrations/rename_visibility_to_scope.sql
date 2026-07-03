-- 迁移脚本：将 visibility 重命名为 scope，并更新枚举值
-- PERSONAL (原 PRIVATE) - 个人记忆
-- TEAM (原 SHARED) - 团队记忆
-- PUBLIC - 公共记忆

-- Step 1: 重命名枚举类型
ALTER TYPE "Visibility" RENAME TO "MemoryScope";

-- Step 2: 重命名枚举值
ALTER TYPE "MemoryScope" RENAME VALUE 'PRIVATE' TO 'PERSONAL';
ALTER TYPE "MemoryScope" RENAME VALUE 'SHARED' TO 'TEAM';
-- PUBLIC 保持不变

-- Step 3: 重命名列
ALTER TABLE "Memory" RENAME COLUMN "visibility" TO "scope";

-- Step 4: 删除旧索引
DROP INDEX IF EXISTS "Memory_visibility_idx";

-- Step 5: 添加新索引
CREATE INDEX "Memory_scope_idx" ON "Memory"("scope");
CREATE INDEX "Memory_projectId_scope_idx" ON "Memory"("projectId", "scope");
CREATE INDEX "Memory_authorId_scope_idx" ON "Memory"("authorId", "scope");
CREATE INDEX "Memory_projectId_type_scope_idx" ON "Memory"("projectId", "type", "scope");
