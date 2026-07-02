"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteProject, fetchProjects } from "@/lib/api/projects";
import { canManageUsers } from "@/lib/auth/permissions";
import { useAuthStore } from "@/lib/auth/store";
import { CreateProjectForm } from "./CreateProjectForm";
import { ProjectMembersDialog } from "./ProjectMembersDialog";

export function ProjectList() {
  const currentUser = useAuthStore((state) => state.user);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ["projects", searchTerm],
    queryFn: () => fetchProjects(searchTerm),
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const showMemberManagement = canManageUsers(currentUser?.systemRole);
  const showCreateProject = canManageUsers(currentUser?.systemRole);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">项目列表</h2>
        {showCreateProject ? (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger render={<Button>创建项目</Button>} />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新项目</DialogTitle>
              </DialogHeader>
              <CreateProjectForm
                onSuccess={() => setIsCreateDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      <Input
        placeholder="搜索项目..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {isLoading ? <div>加载中...</div> : null}
      {isError ? (
        <p className="text-sm text-muted-foreground">
          无法连接 API（{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}
          ）。请先启动 MCP 管理后端。
        </p>
      ) : null}

      {!isLoading && !isError ? (
        <div className="space-y-2">
          {projects?.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无项目</p>
          ) : null}
          {projects?.map((project) => (
            <div
              key={project.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{project.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {project.description || "暂无描述"}
                </p>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                  {project.id}
                </p>
              </div>
              <div className="ml-4 flex shrink-0 gap-2">
                {showMemberManagement ? (
                  <ProjectMembersDialog projectId={project.id} />
                ) : null}
                <Button
                  nativeButton={false}
                  render={<Link href={`/projects/${project.id}/memories`} />}
                >
                  查看记忆
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate(project.id)}
                >
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
