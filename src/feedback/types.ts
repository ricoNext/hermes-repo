export interface RefRecord {
  target: string;
  reason: string;
  session?: string;
  date: string;
}

export interface SkillUsageEntry {
  use_count: number;
  last_used: string;
}

export type SkillUsageMap = Record<string, SkillUsageEntry>;
