/**
 * v2: shouldRunConsolidate 保留为兼容接口，但不再使用。
 * 自动调度逻辑已迁移到 scheduleConsolidate.ts 的 autoFlush 配置。
 * 保留此文件避免其他潜在引用编译失败。
 */

export interface ShouldConsolidateInput {
  repoRoot: string;
  force?: boolean;
  manual?: boolean;
}

export interface ShouldConsolidateResult {
  shouldRun: boolean;
  reason?: string;
  newCaptureCount: number;
  hasConflict: boolean;
  deferredPendingLlm?: boolean;
}

/** v2: 兼容旧入口；非 manual/force 调度由 maybeScheduleConsolidate 处理。 */
export function shouldRunConsolidate(
  input: ShouldConsolidateInput,
): ShouldConsolidateResult {
  if (input.force || input.manual) {
    return {
      shouldRun: true,
      reason: input.manual ? "manual" : "force",
      newCaptureCount: 0,
      hasConflict: false,
    };
  }
  return {
    shouldRun: false,
    newCaptureCount: 0,
    hasConflict: false,
  };
}
