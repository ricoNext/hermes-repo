"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { createUser } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth/store";
import type { SystemRole } from "@/lib/api/types";

const ROLE_OPTIONS: { value: SystemRole; label: string }[] = [
  { value: "MEMBER", label: "项目成员" },
  { value: "ADMIN", label: "管理员" },
  { value: "SUPER_ADMIN", label: "超管" },
];

const EMPTY_FORM = {
  username: "",
  name: "",
  email: "",
  password: "",
  systemRole: "MEMBER" as SystemRole,
};

export function CreateUserDialog() {
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createUser({
        username: form.username.trim(),
        name: form.name.trim(),
        password: form.password,
        email: form.email.trim() || undefined,
        systemRole: form.systemRole,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setForm(EMPTY_FORM);
      setError(null);
      setOpen(false);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("创建用户失败，请稍后重试");
      }
    },
  });

  const canCreateSuperAdmin = currentUser?.systemRole === "SUPER_ADMIN";

  function updateField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>新增用户</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新增用户</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            createMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <label htmlFor="new-user-username" className="text-sm font-medium">
              用户名
            </label>
            <Input
              id="new-user-username"
              autoComplete="off"
              value={form.username}
              onChange={(event) => updateField("username", event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="new-user-name" className="text-sm font-medium">
              姓名
            </label>
            <Input
              id="new-user-name"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="new-user-email" className="text-sm font-medium">
              邮箱（可选）
            </label>
            <Input
              id="new-user-email"
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="new-user-password" className="text-sm font-medium">
              密码
            </label>
            <Input
              id="new-user-password"
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={form.password}
              onChange={(event) => updateField("password", event.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">至少 6 位</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">系统角色</label>
            <Select
              value={form.systemRole}
              onValueChange={(value) =>
                updateField("systemRole", (value ?? "MEMBER") as SystemRole)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.filter(
                  (option) =>
                    option.value !== "SUPER_ADMIN" || canCreateSuperAdmin,
                ).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              取消
            </DialogClose>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
