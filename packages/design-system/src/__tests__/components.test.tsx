import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AgentStatusBadge,
  ContextWindowGauge,
  StackInvariantTag,
  TelemetryCard,
} from "@sibylhub/design-system";

const partitions = {
  rules: 700,
  memories: 1_100,
  ast: 900,
  active: 1_600,
  tools: 700,
};

describe("telemetry primitives", () => {
  it("renders all five context partitions and aggregate progress semantics", () => {
    const markup = renderToStaticMarkup(
      <ContextWindowGauge partitions={partitions} limit={10_000} />,
    );

    expect(markup).toContain('aria-label="Context window usage"');
    expect(markup).toContain('aria-valuemax="10000"');
    expect(markup).toContain("RTK -74.2%");
    expect(markup.match(/role="listitem"/g)).toHaveLength(5);
    expect(markup).toContain("Rules");
    expect(markup).toContain("Tools");
  });

  it("changes gauge state at warning, critical, and overflow thresholds", () => {
    const render = (total: number) => (
      <ContextWindowGauge
        partitions={{ rules: total, memories: 0, ast: 0, active: 0, tools: 0 }}
        limit={100}
      />
    );

    expect(renderToStaticMarkup(render(69))).toContain(
      'data-quota-state="nominal"',
    );
    expect(renderToStaticMarkup(render(70))).toContain(
      'data-quota-state="warning"',
    );
    expect(renderToStaticMarkup(render(85))).toContain(
      'data-quota-state="critical"',
    );
    expect(renderToStaticMarkup(render(96))).toContain(
      'data-quota-state="overflow"',
    );
  });

  it("renders every operational agent state with readable status output", () => {
    for (const status of [
      "running",
      "idle",
      "failed",
      "blocked",
      "awaiting",
    ] as const) {
      const markup = renderToStaticMarkup(<AgentStatusBadge status={status} />);
      expect(markup).toContain(`data-status="${status}"`);
      expect(markup).toContain('role="status"');
      expect(markup).toContain("Agent status:");
    }
  });

  it("supports dense metrics, empty telemetry, and invariant outcomes", () => {
    const card = renderToStaticMarkup(
      <TelemetryCard
        title="Worker telemetry"
        metrics={[{ label: "Latency", value: "42ms", detail: "p95" }]}
      />,
    );
    const emptyCard = renderToStaticMarkup(
      <TelemetryCard title="No feed" metrics={[]} />,
    );
    const compliant = renderToStaticMarkup(
      <StackInvariantTag state="compliant">Contract aligned</StackInvariantTag>,
    );
    const violation = renderToStaticMarkup(
      <StackInvariantTag state="violation">
        Runtime drift detected
      </StackInvariantTag>,
    );

    expect(card).toContain("Worker telemetry");
    expect(card).toContain("42ms");
    expect(emptyCard).toContain("Awaiting telemetry data.");
    expect(compliant).toContain('data-state="compliant"');
    expect(violation).toContain('data-state="violation"');
    expect(violation).toContain("Runtime drift detected");
  });
});
