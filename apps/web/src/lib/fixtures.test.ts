import { describe, expect, it } from "vitest";
import {
  localFixtureSources,
  localMemoriesDocument,
  localMemoryValidation,
  localProjectContext,
} from "./fixtures";

describe("local cockpit fixtures", () => {
  it("validates memory fixture data with the shared schema", () => {
    expect(localMemoryValidation.valid).toBe(true);
    expect(localMemoriesDocument.schemaVersion).toBe("1.0");
  });

  it("keeps deterministic context totals and distinct memory states", () => {
    const { budget } = localProjectContext;
    expect(
      Object.values(budget.partitions).reduce(
        (total, partition) => total + partition.usedTokens,
        0,
      ),
    ).toBe(budget.usedTokens);
    expect(localFixtureSources.unavailable.status).toBe("unavailable");
    expect(localFixtureSources.empty.status).toBe("no_matches");
  });
});
