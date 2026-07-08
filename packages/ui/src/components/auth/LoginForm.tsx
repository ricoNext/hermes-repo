"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { login } from "@/lib/api/auth";
import { useAuthStore } from "@/lib/auth/store";

export function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: () => login(username.trim(), password),
    onSuccess: (data) => {
      setAuth(data.token, data.user);
      // 清除所有查询缓存，确保登录后重新加载数据
      queryClient.clear();
      router.replace("/projects");
    },
    onError: () => {
      setError("用户名或密码错误");
    },
  });

  return (
    <Card className="w-full max-w-md border-stone-200 bg-white shadow-xl">
      <CardHeader className="space-y-3 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg">
          <span className="text-2xl font-bold text-white">H</span>
        </div>
        <CardTitle className="text-2xl font-bold text-stone-900">登录 Hermes</CardTitle>
        <CardDescription className="text-stone-600">
          使用团队账号登录管理后台
        </CardDescription>
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          默认超管：admin / admin
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            loginMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-semibold text-stone-900">
              用户名
            </label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="border-stone-200 bg-white shadow-sm focus:border-amber-500 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-semibold text-stone-900">
              密码
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="border-stone-200 bg-white shadow-sm focus:border-amber-500 focus:ring-amber-500"
            />
          </div>
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm font-medium text-red-900">{error}</p>
            </div>
          ) : null}
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md hover:from-amber-600 hover:to-amber-700"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "登录中..." : "登录"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
