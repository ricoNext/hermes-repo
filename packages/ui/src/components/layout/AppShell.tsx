"use client";

import { FolderKanban, LogOut, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { systemRoleLabel } from "@/lib/api/auth";
import { canManageUsers } from "@/lib/auth/permissions";
import { useAuthStore } from "@/lib/auth/store";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "项目管理",
    href: "/projects",
    icon: FolderKanban,
    match: (pathname: string) => pathname.startsWith("/projects"),
    visible: () => true,
  },
  {
    label: "用户管理",
    href: "/users",
    icon: Users,
    match: (pathname: string) => pathname.startsWith("/users"),
    visible: canManageUsers,
  },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  function handleLogout(): void {
    clearAuth();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-full">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/30">
        <div className="border-b px-4 py-5">
          <Link href="/projects" className="block">
            <span className="text-lg font-semibold tracking-tight">
              Hermes
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              团队记忆管理
            </span>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems
            .filter((item) => item.visible(user?.systemRole))
            .map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          {user ? (
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">
                  @{user.username} · {systemRoleLabel(user.systemRole)}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleLogout}
              >
                <LogOut className="size-3.5" />
                退出登录
              </Button>
            </div>
          ) : null}
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
