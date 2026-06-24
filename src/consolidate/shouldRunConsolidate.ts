/**
 * v2: shouldRunConsolidate 保留为兼容接口，但不再使用。
 * v2 采用懒 consolidate 策略（手动 flush），不自动调度。
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

/** v2: 始终返回 false（自动调度已禁用） */
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
