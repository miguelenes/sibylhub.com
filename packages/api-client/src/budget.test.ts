import { describe, expect, it } from "vitest";
import {
  allocateContextBudget,
  quotaStateFromUsage,
  usagePercentage,
} from "./budget";

describe("context budget contract", () => {
  it("matches the backend weights for exact and rounded ceilings", () => {
    expect(allocateContextBudget(128000)).toEqual({
      rules: 12800,
      memories: 19200,
      ast: 44800,
      active: 38400,
      tools: 12800,
    });
    const rounded = allocateContextBudget(7);
    expect(rounded).toEqual({
      rules: 1,
      memories: 1,
      ast: 2,
      active: 2,
      tools: 1,
    });
    expect(Object.values(rounded).reduce((sum, value) => sum + value, 0)).toBe(
      7,
    );
  });

  it("preserves quota thresholds", () => {
    expect(quotaStateFromUsage(69, 100)).toBe("nominal");
    expect(quotaStateFromUsage(70, 100)).toBe("warning");
    expect(quotaStateFromUsage(85, 100)).toBe("critical");
    expect(quotaStateFromUsage(95, 100)).toBe("critical");
    expect(quotaStateFromUsage(96, 100)).toBe("overflow");
    expect(usagePercentage(0, 100)).toBe(0);
  });
});
