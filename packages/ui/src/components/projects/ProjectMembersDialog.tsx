"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { fetchUsers } from "@/lib/api/auth";
import {
  addProjectMember,
  fetchProjectMembers,
  projectRoleLabel,
  removeProjectMember,
  transferProjectOwnership,
  updateProjectMemberRole,
} from "@/lib/api/projects";
import type { ProjectMember, ProjectRole } from "@/lib/api/types";

const MANAGEABLE_ROLES: Extract<ProjectRole, "ADMIN" | "MEMBER">[] = [
  "MEMBER",
  "ADMIN",
];

function memberBadgeVariant(
  role: ProjectRole,
): "default" | "secondary" | "outline" {
  switch (role) {
    case "OWNER":
      return "default";
    case "ADMIN":
      return "secondary";
    default:
      return "outline";
  }
}

interface ProjectMembersDialogProps {
  projectId: string;
}

export function ProjectMembersDialog({
  projectId,
}: ProjectMembersDialogProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] =
    useState<Extract<ProjectRole, "ADMIN" | "MEMBER">>("MEMBER");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const membersQuery = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: () => fetchProjectMembers(projectId),
    enabled: open,
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
    enabled: open,
  });

  const memberUserIds = useMemo(
    () => new Set((membersQuery.data ?? []).map((m) => m.userId)),
    [membersQuery.data],
  );

  const candidateUsers = useMemo(() => {
    const all = usersQuery.data ?? [];
    const filtered = all.filter((u) => !memberUserIds.has(u.id));
    if (!search.trim()) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q),
    );
  }, [usersQuery.data, memberUserIds, search]);

  const addMutation = useMutation({
    mutationFn: () =>
      addProjectMember(projectId, selectedUserId, selectedRole),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-members", projectId],
      });
      setSelectedUserId("");
      setSelectedRole("MEMBER");
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "添加成员失败");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      member,
      role,
    }: {
      member: ProjectMember;
      role: Extract<ProjectRole, "ADMIN" | "MEMBER">;
    }) => updateProjectMemberRole(projectId, member.userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-members", projectId],
      });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "修改角色失败");
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeProjectMember(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-members", projectId],
      });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "移除成员失败");
    },
  });

  const transferMutation = useMutation({
    mutationFn: (userId: string) =>
      transferProjectOwnership(projectId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["project-members", projectId],
      });
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "转让拥有权失败");
    },
  });

  function handleTransferOwnership(member: ProjectMember) {
    const confirmed = window.confirm(
      `确定将项目拥有权转让给 ${member.name}（@${member.username}）？\n原拥有者将降为项目管理员。`,
    );
    if (confirmed) {
      transferMutation.mutate(member.userId);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setSelectedUserId("");
          setSelectedRole("MEMBER");
          setSearch("");
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline">成员管理</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>项目成员管理</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <section className="space-y-2">
            <h3 className="text-sm font-medium">当前成员</h3>
            {membersQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : null}
            {membersQuery.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无成员</p>
            ) : null}
            <div className="space-y-2">
              {membersQuery.data?.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{member.name}</p>
                      <Badge variant={memberBadgeVariant(member.role)}>
                        {projectRoleLabel(member.role)}
                      </Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      @{member.username}
                      {member.email ? ` · ${member.email}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {member.role === "OWNER" ? null : (
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          updateMutation.mutate({
                            member,
                            role: (value ?? "MEMBER") as Extract<
                              ProjectRole,
                              "ADMIN" | "MEMBER"
                            >,
                          })
                        }
                      >
                        <SelectTrigger size="sm" className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MANAGEABLE_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {projectRoleLabel(role)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {member.role === "OWNER" ? null : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={transferMutation.isPending}
                        onClick={() => handleTransferOwnership(member)}
                      >
                        设为拥有者
                      </Button>
                    )}
                    {member.role === "OWNER" ? null : (
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={removeMutation.isPending}
                        onClick={() => removeMutation.mutate(member.userId)}
                      >
                        移除
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-medium">添加成员</h3>
            <Input
              placeholder="搜索用户（姓名/用户名/邮箱）..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {candidateUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  没有可添加的用户
                </p>
              ) : null}
              {candidateUsers.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUserId(user.id)}
                  className={`flex w-full items-center justify-between rounded-lg border p-2 text-left transition-colors ${
                    selectedUserId === user.id
                      ? "border-ring bg-accent"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{user.username}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={selectedRole}
                onValueChange={(value) =>
                  setSelectedRole(
                    (value ?? "MEMBER") as Extract<ProjectRole, "ADMIN" | "MEMBER">,
                  )
                }
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANAGEABLE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {projectRoleLabel(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!selectedUserId || addMutation.isPending}
                onClick={() => addMutation.mutate()}
              >
                {addMutation.isPending ? "添加中..." : "添加"}
              </Button>
            </div>
          </section>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline">关闭</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
