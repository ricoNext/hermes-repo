"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchUsers, systemRoleLabel } from "@/lib/api/auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { useAuthStore } from "@/lib/auth/store";
import type { SystemRole } from "@/lib/api/types";
import { CreateUserDialog } from "./CreateUserDialog";

function roleBadgeVariant(
  role: SystemRole,
): "default" | "secondary" | "outline" {
  switch (role) {
    case "SUPER_ADMIN":
      return "default";
    case "ADMIN":
      return "secondary";
    default:
      return "outline";
  }
}

export function UserManagementPanel() {
  const currentUser = useAuthStore((state) => state.user);
  const { data: users, isLoading, isError } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const showCreateButton = canManageUsers(currentUser?.systemRole);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>用户列表</CardTitle>
          {showCreateButton ? <CreateUserDialog /> : null}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}
        {isError ? (
          <p className="text-sm text-muted-foreground">无法加载用户列表</p>
        ) : null}
        {!isLoading && !isError ? (
          <div className="space-y-2">
            {users?.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{user.name}</p>
                    <Badge variant={roleBadgeVariant(user.systemRole)}>
                      {systemRoleLabel(user.systemRole)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    @{user.username}
                    {user.email ? ` · ${user.email}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {user.id}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
