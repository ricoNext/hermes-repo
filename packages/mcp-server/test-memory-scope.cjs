#!/usr/bin/env node
/**
 * 测试脚本：验证记忆范围（scope）功能
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test() {
  try {
    console.log('🧪 测试记忆范围功能...\n');

    // 1. 查询所有记忆并按 scope 分组
    const allMemories = await prisma.memory.findMany({
      include: { author: true },
      orderBy: { createdAt: 'desc' },
    });

    console.log('📊 记忆统计:');
    const stats = {
      PERSONAL: allMemories.filter(m => m.scope === 'PERSONAL').length,
      TEAM: allMemories.filter(m => m.scope === 'TEAM').length,
      PUBLIC: allMemories.filter(m => m.scope === 'PUBLIC').length,
    };
    console.log(`  个人记忆 (PERSONAL): ${stats.PERSONAL}`);
    console.log(`  团队记忆 (TEAM): ${stats.TEAM}`);
    console.log(`  公共记忆 (PUBLIC): ${stats.PUBLIC}`);
    console.log(`  总计: ${allMemories.length}\n`);

    // 2. 展示各类记忆示例
    console.log('📝 记忆示例:\n');

    const personal = allMemories.find(m => m.scope === 'PERSONAL');
    if (personal) {
      console.log(`个人记忆: "${personal.title}"`);
      console.log(`  作者: ${personal.author.name}`);
      console.log(`  类型: ${personal.type}`);
      console.log(`  范围: ${personal.scope}`);
      console.log();
    }

    const team = allMemories.find(m => m.scope === 'TEAM');
    if (team) {
      console.log(`团队记忆: "${team.title}"`);
      console.log(`  作者: ${team.author.name}`);
      console.log(`  类型: ${team.type}`);
      console.log(`  范围: ${team.scope}`);
      console.log();
    }

    const publicMemory = allMemories.find(m => m.scope === 'PUBLIC');
    if (publicMemory) {
      console.log(`公共记忆: "${publicMemory.title}"`);
      console.log(`  作者: ${publicMemory.author.name}`);
      console.log(`  类型: ${publicMemory.type}`);
      console.log(`  范围: ${publicMemory.scope}`);
      console.log();
    }

    // 3. 测试权限过滤（模拟查询逻辑）
    const testUserId = allMemories[0]?.authorId;
    if (testUserId) {
      console.log(`🔍 模拟用户 ${testUserId.slice(0, 8)}... 的可见记忆:`);

      const visibleMemories = allMemories.filter(m => {
        // PUBLIC - 所有人可见
        if (m.scope === 'PUBLIC') return true;
        // TEAM - 项目成员可见（这里简化为所有记忆）
        if (m.scope === 'TEAM') return true;
        // PERSONAL - 仅作者可见
        if (m.scope === 'PERSONAL' && m.authorId === testUserId) return true;
        return false;
      });

      console.log(`  可见记忆总数: ${visibleMemories.length}`);
      console.log(`    个人: ${visibleMemories.filter(m => m.scope === 'PERSONAL').length}`);
      console.log(`    团队: ${visibleMemories.filter(m => m.scope === 'TEAM').length}`);
      console.log(`    公共: ${visibleMemories.filter(m => m.scope === 'PUBLIC').length}`);
    }

    console.log('\n✅ 测试完成！');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

test();
