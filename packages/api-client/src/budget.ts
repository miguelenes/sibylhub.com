import {
  contextPartitionNames,
  type ContextPartitionName,
  type QuotaState,
} from "./contracts.js";

export const contextBudgetWeights: Record<ContextPartitionName, number> = {
  rules: 10,
  memories: 15,
  ast: 35,
  active: 30,
  tools: 10,
};

export type ContextBudgetAllocation = Record<ContextPartitionName, number>;

export function allocateContextBudget(
  ceilingTokens: number,
): ContextBudgetAllocation {
  if (!Number.isSafeInteger(ceilingTokens) || ceilingTokens < 0)
    throw new RangeError("Context ceiling must be a non-negative safe integer");

  const allocations = {} as ContextBudgetAllocation;
  const remainders: Array<{
    name: ContextPartitionName;
    remainder: number;
    index: number;
  }> = [];
  let allocated = 0;

  contextPartitionNames.forEach((name, index) => {
    const weighted = ceilingTokens * contextBudgetWeights[name];
    const value = Math.floor(weighted / 100);
    allocations[name] = value;
    allocated += value;
    remainders.push({ name, remainder: weighted % 100, index });
  });

  let remaining = ceilingTokens - allocated;
  remainders.sort(
    (left, right) =>
      right.remainder - left.remainder || left.index - right.index,
  );
  for (const { name } of remainders) {
    if (remaining === 0) break;
    allocations[name] += 1;
    remaining -= 1;
  }
  return allocations;
}

export function quotaStateFromPercentage(percentage: number): QuotaState {
  if (percentage > 95) return "overflow";
  if (percentage >= 85) return "critical";
  if (percentage >= 70) return "warning";
  return "nominal";
}

export function quotaStateFromUsage(
  usedTokens: number,
  ceilingTokens: number,
): QuotaState {
  if (!Number.isFinite(usedTokens) || !Number.isFinite(ceilingTokens))
    return "nominal";
  const percentage =
    ceilingTokens > 0
      ? (Math.max(0, usedTokens) / ceilingTokens) * 100
      : usedTokens > 0
        ? 100
        : 0;
  return quotaStateFromPercentage(percentage);
}

export function usagePercentage(
  usedTokens: number,
  ceilingTokens: number,
): number {
  if (ceilingTokens <= 0) return usedTokens > 0 ? 100 : 0;
  return (Math.max(0, usedTokens) / ceilingTokens) * 100;
}
