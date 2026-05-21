/** 自上次 consolidate 以来新 capture 数量阈值 */
export const CONSOLIDATE_COUNT_THRESHOLD = 10;

/** 时间驱动：小时 */
export const CONSOLIDATE_HOURS_THRESHOLD = 24;

/** 运行锁过期（毫秒） */
export const CONSOLIDATE_LOCK_TTL_MS = 30 * 60 * 1000;

/** MEMORY 注入上限（与 inject 一致） */
export { INJECT_MAX_CHARS } from "../inject/constants.js";

/** 最近经验窗口（天） */
export const RECENT_EXPERIENCE_DAYS = 7;

/** 规则 MEMORY 最近条目上限 */
export const RECENT_EXPERIENCE_MAX = 8;

/** 活跃主题 tag 上限 */
export const ACTIVE_TOPIC_MAX = 6;
