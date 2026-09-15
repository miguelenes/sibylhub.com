import { ContextWindowGauge, TelemetryCard } from "@sibylhub/design-system";
import type { ProjectContextResponse } from "@sibylhub/api-client";

interface Props {
  context: ProjectContextResponse;
  displayStatus: "ready" | "degraded" | "stale" | "unavailable";
}

const numberFormat = new Intl.NumberFormat("en-US");
const partitionLabels = [
  ["rules", "Rules"],
  ["memories", "Memories"],
  ["ast", "AST"],
  ["active", "Active"],
  ["tools", "Tools"],
] as const;

function formatTokens(value: number): string {
  return numberFormat.format(value);
}

export function ContextObservatory({ context, displayStatus }: Props) {
  const { budget } = context;
  const gaugePartitions = {
    rules: budget.partitions.rules.usedTokens,
    memories: budget.partitions.memories.usedTokens,
    ast: budget.partitions.ast.usedTokens,
    active: budget.partitions.active.usedTokens,
    tools: budget.partitions.tools.usedTokens,
  };
  const statusMessage =
    displayStatus === "unavailable"
      ? "The configured context source is unavailable. Displayed values are the deterministic local shape."
      : displayStatus === "stale"
        ? "This snapshot is stale and should not be treated as current policy evidence."
        : displayStatus === "degraded"
          ? "This is a degraded snapshot with local or partial source data."
          : "This snapshot is ready for inspection.";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
      <div className="min-w-0">
        <ContextWindowGauge
          partitions={gaugePartitions}
          limit={budget.ceilingTokens}
          savings={budget.rtkSavings}
          label={`${context.project.name} context window`}
          data-source={context.source}
          data-snapshot-status={displayStatus}
        />
        <ul
          className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5"
          aria-label="Context partition percentages"
        >
          {partitionLabels.map(([name, label]) => {
            const partition = budget.partitions[name];
            return (
              <li
                key={name}
                className="min-w-0 rounded-md border border-border/70 bg-surface/60 px-2 py-2"
              >
                <p className="truncate font-mono text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-foreground">
                  {Math.round(partition.percentage)}%
                </p>
                <p className="mt-1 break-words text-[0.6875rem] text-muted-foreground">
                  {formatTokens(partition.usedTokens)} tokens
                </p>
              </li>
            );
          })}
        </ul>
        <p
          className="mt-3 rounded-md border border-border/70 bg-surface/60 px-3 py-2 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <span className="font-semibold text-foreground">
            {displayStatus}:
          </span>{" "}
          {statusMessage}
        </p>
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <TelemetryCard
          title="Budget summary"
          metrics={[
            { label: "Active usage", value: formatTokens(budget.usedTokens) },
            {
              label: "Ceiling",
              value: formatTokens(budget.ceilingTokens),
            },
            {
              label: "Quota state",
              value: budget.quotaState.toUpperCase(),
              detail: `${Math.round(budget.usagePercent)}% of the configured ceiling`,
            },
            {
              label: "RTK savings",
              value: budget.rtkSavings,
              detail: budget.rtkSavingsIsDefault
                ? "Default value"
                : "Snapshot value",
            },
          ]}
        />
        <TelemetryCard
          title="Source identity"
          metrics={[
            { label: "Project", value: context.project.id },
            { label: "Source", value: context.source.toUpperCase() },
            { label: "Revision", value: context.sourceRevision },
            { label: "Dependencies", value: context.dependencies.length },
          ]}
        />
      </div>
    </div>
  );
}
