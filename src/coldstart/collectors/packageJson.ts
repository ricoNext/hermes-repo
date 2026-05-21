import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { PackageJsonScan } from "./types.js";

const STACK_HINTS: Record<string, string> = {
  react: "react",
  vue: "vue",
  next: "nextjs",
  express: "express",
  prisma: "prisma",
  typescript: "typescript",
  vitest: "vitest",
  jest: "jest",
  bun: "bun",
  vite: "vite",
  tailwindcss: "tailwind",
};

function depKeys(record: Record<string, string> | undefined): string[] {
  if (!record) {
    return [];
  }
  return Object.keys(record);
}

export function inferStackTags(deps: string[]): string[] {
  const tags = new Set<string>();
  for (const dep of deps) {
    const lower = dep.toLowerCase();
    for (const [key, tag] of Object.entries(STACK_HINTS)) {
      if (lower.includes(key)) {
        tags.add(tag);
      }
    }
  }
  return [...tags];
}

export function collectPackageJson(repoRoot: string): PackageJsonScan | null {
  const path = join(repoRoot, "package.json");
  if (!existsSync(path)) {
    return null;
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      name: raw.name,
      dependencies: depKeys(raw.dependencies),
      devDependencies: depKeys(raw.devDependencies),
    };
  } catch {
    return null;
  }
}
