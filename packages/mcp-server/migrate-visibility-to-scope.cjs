#!/usr/bin/env node
/**
 * 数据迁移脚本：将 visibility 字段重命名为 scope
 * 并将枚举值从 PRIVATE/SHARED/PUBLIC 更新为 PERSONAL/TEAM/PUBLIC
 */

const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://hermes:hermes@localhost:5432/hermes_memory'
  });

  try {
    await client.connect();
    console.log('✓ 连接到数据库');

    // Step 1: 检查是否已经迁移过
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Memory' AND column_name IN ('visibility', 'scope');
    `);

    const hasVisibility = checkColumn.rows.some(r => r.column_name === 'visibility');
    const hasScope = checkColumn.rows.some(r => r.column_name === 'scope');

    if (!hasVisibility && hasScope) {
      console.log('✓ 迁移已完成，跳过');
      return;
    }

    if (!hasVisibility) {
      console.error('✗ 错误：未找到 visibility 列');
      process.exit(1);
    }

    console.log('开始迁移...');

    // Step 2: 重命名枚举类型
    await client.query('ALTER TYPE "Visibility" RENAME TO "MemoryScope";');
    console.log('✓ 枚举类型重命名: Visibility → MemoryScope');

    // Step 3: 更新枚举值
    await client.query('ALTER TYPE "MemoryScope" RENAME VALUE \'PRIVATE\' TO \'PERSONAL\';');
    console.log('✓ 枚举值更新: PRIVATE → PERSONAL');

    await client.query('ALTER TYPE "MemoryScope" RENAME VALUE \'SHARED\' TO \'TEAM\';');
    console.log('✓ 枚举值更新: SHARED → TEAM');

    // Step 4: 重命名列
    await client.query('ALTER TABLE "Memory" RENAME COLUMN "visibility" TO "scope";');
    console.log('✓ 列重命名: visibility → scope');

    // Step 5: 删除旧索引
    await client.query('DROP INDEX IF EXISTS "Memory_visibility_idx";');
    console.log('✓ 删除旧索引: Memory_visibility_idx');

    // Step 6: 创建新索引
    await client.query('CREATE INDEX "Memory_scope_idx" ON "Memory"("scope");');
    console.log('✓ 创建索引: Memory_scope_idx');

    await client.query('CREATE INDEX "Memory_projectId_scope_idx" ON "Memory"("projectId", "scope");');
    console.log('✓ 创建索引: Memory_projectId_scope_idx');

    await client.query('CREATE INDEX "Memory_authorId_scope_idx" ON "Memory"("authorId", "scope");');
    console.log('✓ 创建索引: Memory_authorId_scope_idx');

    await client.query('CREATE INDEX "Memory_projectId_type_scope_idx" ON "Memory"("projectId", "type", "scope");');
    console.log('✓ 创建索引: Memory_projectId_type_scope_idx');

    console.log('\n✅ 迁移完成！');

    // 显示迁移后的数据统计
    const stats = await client.query(`
      SELECT scope, COUNT(*) as count
      FROM "Memory"
      GROUP BY scope;
    `);

    console.log('\n记忆统计:');
    stats.rows.forEach(row => {
      console.log(`  ${row.scope}: ${row.count}`);
    });

  } catch (error) {
    console.error('✗ 迁移失败:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
