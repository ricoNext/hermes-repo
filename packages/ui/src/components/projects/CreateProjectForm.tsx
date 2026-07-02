"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProject } from "@/lib/api/projects";

const schema = z.object({
  name: z.string().min(1, "请输入项目名称"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CreateProjectFormProps {
  onSuccess: () => void;
}

export function CreateProjectForm({ onSuccess }: CreateProjectFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    await createProject(values);
    reset();
    onSuccess();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Input placeholder="项目名称" {...register("name")} />
        {errors.name ? (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        ) : null}
      </div>
      <Input placeholder="项目描述（可选）" {...register("description")} />
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "创建中..." : "创建项目"}
      </Button>
    </form>
  );
}
