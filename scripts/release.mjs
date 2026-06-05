#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.stdio ?? "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result.stdout?.trim() ?? "";
}

function git(args, options = {}) {
  return run("git", args, options);
}

function assertCleanWorktree() {
  const status = git(["status", "--porcelain"], { stdio: "pipe" });
  if (status) {
    throw new Error(
      "Working tree is not clean. Commit or stash unrelated changes before release.",
    );
  }
}

function currentBranch() {
  return git(["branch", "--show-current"], { stdio: "pipe" });
}

function packageVersion() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  if (!pkg.version || typeof pkg.version !== "string") {
    throw new Error("package.json version is missing");
  }
  return pkg.version;
}

function tagExists(tag) {
  const result = spawnSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

function main() {
  const branch = currentBranch();
  if (!branch) {
    throw new Error("Cannot release from detached HEAD");
  }

  assertCleanWorktree();

  run("bun", ["run", "changeset:version"]);
  run("bun", ["install"]);
  run("bun", ["run", "typecheck"]);
  run("bun", ["run", "test"]);

  const version = packageVersion();
  const tag = `v${version}`;
  if (tagExists(tag)) {
    throw new Error(`Tag already exists: ${tag}`);
  }

  git(["add", "package.json", "bun.lock", "CHANGELOG.md", ".changeset"]);
  git(["commit", "-m", `chore: release ${version}`]);
  git(["tag", tag]);
  git(["push", "origin", branch]);
  git(["push", "origin", tag]);

  console.log(`Released ${tag}. GitHub Actions will publish npm from the tag.`);
}

try {
  main();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`release failed: ${msg}`);
  process.exit(1);
}
