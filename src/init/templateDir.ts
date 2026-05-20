import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PACKAGE_NAME } from "../index.js";

function resolveTemplateDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "templates"),
    join(here, "..", "..", "templates"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) {
      return dir;
    }
  }
  return join(here, "templates");
}

const templateDir = resolveTemplateDir();

export function resolveTemplatePath(name: string): string {
  return join(templateDir, name);
}

export function readTemplate(name: string): string {
  return readFileSync(resolveTemplatePath(name), "utf8");
}

export function renderTemplate(name: string): string {
  const raw = readTemplate(name);
  return raw.replaceAll("__PACKAGE_NAME__", PACKAGE_NAME);
}
