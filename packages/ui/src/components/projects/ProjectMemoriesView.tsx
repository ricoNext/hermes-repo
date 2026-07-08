"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { MemoryExplorer } from "@/components/memories/MemoryExplorer";
import { ProjectMembersDialog } from "@/components/projects/ProjectMembersDialog";
import { fetchProjects } from "@/lib/api/projects";
import { useAuthStore } from "@/lib/auth/store";

interface ProjectMemoriesViewProps {
  projectId: string;
}

function canManageProjectMembers(
  role: "SUPER_ADMIN" | "ADMIN" | "MEMBER" | undefined,
): boolean {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function ProjectMemoriesView({ projectId }: ProjectMemoriesViewProps) {
  const currentUser = useAuthStore((state) => state.user);
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects(),
  });

  const project = projects?.find((item) => item.id === projectId);
  const showMemberManagement = canManageProjectMembers(
    currentUser?.systemRole,
  );

  return (
    <div className="space-y-8">
      <header>
        <nav
          aria-label="面包屑"
          className="mb-4 flex items-center gap-1.5 text-sm"
        >
          <Link href="/projects" className="text-stone-500 transition-colors hover:text-stone-900">
            项目管理
          </Link>
          <ChevronRight className="size-4 text-stone-400" />
          <span className="font-medium text-stone-900">
            {project?.name ?? "加载中..."}
          </span>
          <ChevronRight className="size-4 text-stone-400" />
          <span className="font-medium text-stone-900">记忆</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 shadow-sm">
              项目记忆
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-stone-900">
              {project?.name ?? "项目记忆"}
            </h1>
            {project?.description ? (
              <p className="mt-3 text-base leading-relaxed text-stone-600">
                {project.description}
              </p>
            ) : null}
            <p className="mt-2 font-mono text-xs text-stone-400">
              {projectId}
            </p>
          </div>
          {showMemberManagement ? (
            <ProjectMembersDialog projectId={projectId} />
          ) : null}
        </div>
      </header>
      <MemoryExplorer projectId={projectId} />
    </div>
  );
}
