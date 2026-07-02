"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { canManageUsers } from "@/lib/auth/permissions";
import { useAuthStore } from "@/lib/auth/store";

export function UserManagementGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user && !canManageUsers(user.systemRole)) {
      router.replace("/projects");
    }
  }, [user, router]);

  if (!user || !canManageUsers(user.systemRole)) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-muted-foreground">
        无权限访问
      </div>
    );
  }

  return children;
}
