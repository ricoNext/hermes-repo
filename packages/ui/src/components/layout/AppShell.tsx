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
    <>
      {/* 左侧边栏 - 浮动卡片式设计 */}
      <aside className="flex h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-stone-50 to-stone-100/50 p-4">
        {/* 头部 Logo */}
        <div className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-stone-200/50">
          <Link href="/projects" className="block">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md">
                <span className="text-sm font-bold">H</span>
              </div>
              <div className="flex-1">
                <span className="block text-base font-semibold tracking-tight text-stone-900">
                  Hermes
                </span>
                <span className="block text-xs font-medium text-stone-500">
                  团队记忆
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* 导航区域 - 占据剩余空间 */}
        <nav className="mb-4 flex flex-1 flex-col gap-1.5 overflow-y-auto rounded-xl bg-white p-2 shadow-sm ring-1 ring-stone-200/50">
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
                  "group flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
                )}
              >
                <Icon className={cn(
                  "size-4 shrink-0 transition-transform duration-200",
                  active ? "text-white" : "text-stone-400 group-hover:text-stone-600"
                )} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* 用户信息 - 固定在底部 */}
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-200/50">
          {user ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 text-sm font-semibold text-white shadow-md">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">{user.name}</p>
                  <p className="truncate text-xs text-stone-500">
                    @{user.username}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-amber-600">
                    {systemRoleLabel(user.systemRole)}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                onClick={handleLogout}
              >
                <LogOut className="size-3.5" />
                退出登录
              </Button>
            </div>
          ) : null}
        </div>
      </aside>

      {/* 主内容区域 - 占据剩余空间并可滚动 */}
      <main className="flex-1 overflow-y-auto bg-stone-50">{children}</main>
    </>
  );
}
