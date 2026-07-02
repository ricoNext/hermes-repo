import { UserManagementPanel } from "@/components/users/UserManagementPanel";
import { UserManagementGuard } from "@/components/auth/UserManagementGuard";

export default function UsersPage() {
  return (
    <UserManagementGuard>
      <div className="container mx-auto p-6">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
          <p className="mt-2 text-muted-foreground">
            管理团队成员账号与系统角色。
          </p>
        </header>
        <UserManagementPanel />
      </div>
    </UserManagementGuard>
  );
}
