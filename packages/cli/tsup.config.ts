import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig } from "tsup";

const templatesSrc = join(process.cwd(), "templates");
const templatesDist = join(process.cwd(), "dist", "templates");

function copyTemplates(): void {
  if (!existsSync(templatesSrc)) {
    return;
  }
  mkdirSync(join(process.cwd(), "dist"), { recursive: true });
  cpSync(templatesSrc, templatesDist, { recursive: true });
}

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  outDir: "dist",
  clean: true,
  dts: false,
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  onSuccess: async () => {
    copyTemplates();
  },
});
