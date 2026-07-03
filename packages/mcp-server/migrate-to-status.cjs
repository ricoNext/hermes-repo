#!/usr/bin/env node
/**
 * 数据迁移脚本：将 scope 字段重命名为 status
 * 并将枚举值从 PERSONAL/TEAM/PUBLIC 更新为 PENDING/ARCHIVED/TRASH
 */

const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ||
      'postgresql://hermes:hermes@localhost:5432/hermes_memory'
  });

  try {
    await client.connect();
    console.log('✓ 连接到数据库');

    // 检查是否已迁移
    const checkStatus = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'Memory' AND column_name = 'status';
    `);

    if (checkStatus.rows.length > 0) {
      console.log('✓ 已完成迁移，跳过');
      return;
    }

    console.log('\n开始迁移...\n');

    // 1. 创建新枚举
    await client.query(`
      CREATE TYPE "MemoryStatus" AS ENUM ('PENDING', 'ARCHIVED', 'TRASH');
    `);
    console.log('✓ 创建 MemoryStatus 枚举');

    // 2. 添加 status 列
    await client.query(`
      ALTER TABLE "Memory" ADD COLUMN "status" "MemoryStatus" DEFAULT 'PENDING';
    `);
    console.log('✓ 添加 status 列');

    // 3. 数据迁移：TEAM/PUBLIC → ARCHIVED, PERSONAL → PENDING
    await client.query(`
      UPDATE "Memory" SET "status" =
        CASE
          WHEN "scope" = 'TEAM' THEN 'ARCHIVED'::"MemoryStatus"
          WHEN "scope" = 'PUBLIC' THEN 'ARCHIVED'::"MemoryStatus"
          ELSE 'PENDING'::"MemoryStatus"
        END;
    `);
    console.log('✓ 迁移现有数据');

    // 4. 删除旧列
    await client.query(`ALTER TABLE "Memory" DROP COLUMN "scope";`);
    console.log('✓ 删除 scope 列');

    // 5. 删除旧枚举
    await client.query(`DROP TYPE "MemoryScope";`);
    console.log('✓ 删除 MemoryScope 枚举');

    // 6. 添加审核字段
    await client.query(`
      ALTER TABLE "Memory"
      ADD COLUMN "reviewerId" TEXT,
      ADD COLUMN "reviewedAt" TIMESTAMP,
      ADD COLUMN "reviewNote" TEXT;
    `);
    console.log('✓ 添加审核字段');

    // 7. 添加外键约束
    await client.query(`
      ALTER TABLE "Memory"
      ADD CONSTRAINT "Memory_reviewerId_fkey"
      FOREIGN KEY ("reviewerId") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
    `);
    console.log('✓ 添加外键约束');

    // 8. 更新索引
    await client.query(`DROP INDEX IF EXISTS "Memory_scope_idx";`);
    await client.query(`DROP INDEX IF EXISTS "Memory_projectId_scope_idx";`);
    await client.query(`DROP INDEX IF EXISTS "Memory_authorId_scope_idx";`);
    await client.query(`DROP INDEX IF EXISTS "Memory_projectId_type_scope_idx";`);

    await client.query(`
      CREATE INDEX "Memory_projectId_status_idx" ON "Memory"("projectId", "status");
    `);
    await client.query(`
      CREATE INDEX "Memory_status_createdAt_idx" ON "Memory"("status", "createdAt");
    `);
    console.log('✓ 更新索引');

    console.log('\n✅ 迁移完成！\n');

    // 显示统计信息
    const stats = await client.query(`
      SELECT status, COUNT(*) as count FROM "Memory" GROUP BY status;
    `);

    console.log('记忆统计：');
    stats.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count}`);
    });

  } catch (error) {
    console.error('\n✗ 迁移失败:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
