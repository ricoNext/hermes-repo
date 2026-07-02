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
    <div className="space-y-6">
      <header>
        <nav
          aria-label="面包屑"
          className="mb-3 flex items-center gap-1 text-sm text-muted-foreground"
        >
          <Link href="/projects" className="hover:text-foreground">
            项目管理
          </Link>
          <ChevronRight className="size-4" />
          <span className="text-foreground">
            {project?.name ?? "加载中..."}
          </span>
          <ChevronRight className="size-4" />
          <span className="text-foreground">记忆</span>
        </nav>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">
              {project?.name ?? "项目记忆"}
            </h1>
            {project?.description ? (
              <p className="mt-2 text-muted-foreground">
                {project.description}
              </p>
            ) : null}
            <p className="mt-1 font-mono text-xs text-muted-foreground">
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
