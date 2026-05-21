/** 同主 tag 的 procedural 达到此次数可晋升 Skill */
export const SKILL_PROMOTE_COUNT_THRESHOLD = 3;

/** 步骤数 ≤ 此值且非高风险、无 .promote 时不晋升 */
export const SKILL_MIN_STEPS_FOR_PROMOTE = 3;

export const HIGH_RISK_KEYWORDS = [
  "deploy",
  "deployment",
  "migration",
  "migrate",
  "rollback",
  "release",
  "restore",
  "recovery",
  "发布",
  "部署",
  "迁移",
  "回滚",
] as const;
