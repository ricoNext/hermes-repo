import { ProjectList } from "@/components/projects/ProjectList";

export default function ProjectsPage() {
  return (
    <div className="container mx-auto p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">项目管理</h1>
        <p className="mt-2 text-muted-foreground">
          创建和管理团队项目，进入项目后可查看与维护记忆。
        </p>
      </header>
      <ProjectList />
    </div>
  );
}
