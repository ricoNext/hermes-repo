import { ProjectList } from "@/components/projects/ProjectList";

export default function ProjectsPage() {
  return (
    <div className="container mx-auto max-w-6xl p-8">
      <header className="mb-10">
        <div className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm">
          项目中心
        </div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-stone-900">
          项目管理
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-stone-600">
          创建和管理团队项目，进入项目后可查看与维护记忆。
        </p>
      </header>
      <ProjectList />
    </div>
  );
}
