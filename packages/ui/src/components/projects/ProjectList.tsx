"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ["projects", searchTerm],
    queryFn: () => fetchProjects(searchTerm),
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setDeleteDialogOpen(false);
      setProjectToDelete(null);
    },
    onError: (error) => {
      console.error("删除项目失败:", error);
      alert(`删除失败: ${error instanceof Error ? error.message : "未知错误"}`);
    },
  });

  const handleDeleteClick = (project: { id: string; name: string }) => {
    setProjectToDelete(project);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (projectToDelete) {
      deleteMutation.mutate(projectToDelete.id);
    }
  };

  const showMemberManagement = canManageUsers(currentUser?.systemRole);
  const showCreateProject = currentUser?.systemRole === "SUPER_ADMIN";
  const showDeleteProject = currentUser?.systemRole === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-stone-900">项目列表</h2>
          <p className="mt-1 text-sm text-stone-500">管理和访问您的团队项目</p>
        </div>
        {showCreateProject ? (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger render={
              <Button className="bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md hover:from-amber-600 hover:to-amber-700">
                创建项目
              </Button>
            } />
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
        placeholder="搜索项目名称或描述..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="border-stone-200 bg-white shadow-sm"
      />

      {isLoading ? <div className="text-sm text-stone-600">加载中...</div> : null}
      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-900">无法连接 API</p>
          <p className="mt-1 text-sm text-red-700">
            请确保 MCP 管理后端已启动（{process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"}）
          </p>
        </div>
      ) : null}

      {!isLoading && !isError ? (
        <div className="space-y-3">
          {projects?.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm">
              <p className="text-sm text-stone-500">暂无项目</p>
              <p className="mt-1 text-xs text-stone-400">创建您的第一个项目开始使用</p>
            </div>
          ) : null}
          {projects?.map((project) => (
            <div
              key={project.id}
              className="group flex items-center justify-between rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:border-stone-300 hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-stone-900">{project.name}</h3>
                <p className="mt-1 text-sm text-stone-600">
                  {project.description || "暂无描述"}
                </p>
                <p className="mt-2 truncate font-mono text-xs text-stone-400">
                  {project.id}
                </p>
              </div>
              <div className="ml-6 flex shrink-0 gap-2">
                {showMemberManagement ? (
                  <ProjectMembersDialog projectId={project.id} />
                ) : null}
                <Button
                  nativeButton={false}
                  render={<Link href={`/projects/${project.id}/memories`} />}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md hover:from-amber-600 hover:to-amber-700"
                >
                  查看记忆
                </Button>
                {showDeleteProject ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteClick({ id: project.id, name: project.name })}
                  >
                    删除
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除项目</DialogTitle>
            <DialogDescription>
              您确定要删除项目 <span className="font-semibold text-stone-900">{projectToDelete?.name}</span> 吗？
              此操作不可撤销，项目中的所有记忆数据也将被永久删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteMutation.isPending}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
