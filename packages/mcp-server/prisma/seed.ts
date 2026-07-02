import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/password.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      name: "系统管理员",
      email: "admin@hermes.local",
      systemRole: "SUPER_ADMIN",
      passwordHash: hashPassword("admin"),
    },
    create: {
      username: "admin",
      email: "admin@hermes.local",
      name: "系统管理员",
      systemRole: "SUPER_ADMIN",
      passwordHash: hashPassword("admin"),
    },
  });

  const devEmail = process.env.SEED_USER_EMAIL ?? "dev@hermes.local";
  const devName = process.env.SEED_USER_NAME ?? "Dev User";
  const devUsername = process.env.SEED_USER_USERNAME ?? "dev";

  const devUser = await prisma.user.upsert({
    where: { username: devUsername },
    update: {
      name: devName,
      email: devEmail,
      passwordHash: hashPassword(process.env.SEED_USER_PASSWORD ?? "dev"),
    },
    create: {
      username: devUsername,
      email: devEmail,
      name: devName,
      systemRole: "MEMBER",
      passwordHash: hashPassword(process.env.SEED_USER_PASSWORD ?? "dev"),
    },
  });

  const project = await prisma.project.upsert({
    where: {
      id: process.env.SEED_PROJECT_ID ?? "00000000-0000-4000-8000-000000000001",
    },
    update: {
      name: process.env.SEED_PROJECT_NAME ?? "默认项目",
      description: "开发环境种子项目",
    },
    create: {
      id: process.env.SEED_PROJECT_ID ?? "00000000-0000-4000-8000-000000000001",
      name: process.env.SEED_PROJECT_NAME ?? "默认项目",
      description: "开发环境种子项目",
    },
  });

  for (const user of [admin, devUser]) {
    await prisma.projectRole.upsert({
      where: {
        userId_projectId: {
          userId: user.id,
          projectId: project.id,
        },
      },
      update: { role: user.id === admin.id ? "OWNER" : "MEMBER" },
      create: {
        userId: user.id,
        projectId: project.id,
        role: user.id === admin.id ? "OWNER" : "MEMBER",
      },
    });
  }

  const existing = await prisma.memory.count({ where: { projectId: project.id } });
  if (existing === 0) {
    await prisma.memory.create({
      data: {
        title: "欢迎使用 Hermes 团队记忆",
        content: "这是一条示例记忆。可通过 MCP 工具或管理 UI 创建更多记忆。",
        type: "NOTE",
        visibility: "SHARED",
        importance: 3,
        tags: ["onboarding"],
        authorId: admin.id,
        projectId: project.id,
      },
    });
  }

  console.log(
    `Seeded admin=${admin.username} (SUPER_ADMIN), dev=${devUser.username}, project=${project.name}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
