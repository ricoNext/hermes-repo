export interface PackageJsonScan {
  name?: string;
  dependencies: string[];
  devDependencies: string[];
}

export interface RepoSignalsScan {
  signals: string[];
}

export interface GitLogScan {
  lines: string[];
}

export interface ExistingRulesScan {
  sources: Array<{ path: string; excerpt: string }>;
}

export interface ProjectScanData {
  packageJson: PackageJsonScan | null;
  repoSignals: RepoSignalsScan;
  gitLog: GitLogScan;
  existingRules: ExistingRulesScan;
  warnings: string[];
}
