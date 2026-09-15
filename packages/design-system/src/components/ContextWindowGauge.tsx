import * as Progress from "@radix-ui/react-progress";
import { Activity, BookOpen, Brain, Braces, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import {
  contextPartitionNames,
  type ContextPartitionName,
  type ContextWindowGaugeProps,
} from "./types";

const partitionLabels: Record<ContextPartitionName, string> = {
  rules: "Rules",
  memories: "Memories",
  ast: "AST",
  active: "Active",
  tools: "Tools",
};

const partitionIcons: Record<ContextPartitionName, LucideIcon> = {
  rules: BookOpen,
  memories: Brain,
  ast: Braces,
  active: Activity,
  tools: Wrench,
};

const partitionColors: Record<ContextPartitionName, string> = {
  rules: "bg-context-rules",
  memories: "bg-context-memories",
  ast: "bg-context-ast",
  active: "bg-context-active",
  tools: "bg-context-tools",
};

type QuotaState = "nominal" | "warning" | "critical" | "overflow";

const quotaColors: Record<QuotaState, string> = {
  nominal: "text-quota-nominal",
  warning: "text-quota-warning",
  critical: "text-quota-critical",
  overflow: "text-quota-overflow",
};

function finiteTokens(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function quotaState(percentage: number): QuotaState {
  if (percentage > 95) return "overflow";
  if (percentage >= 85) return "critical";
  if (percentage >= 70) return "warning";
  return "nominal";
}

function formatTokens(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function ContextWindowGauge({
  partitions,
  limit,
  savings = "-74.2%",
  label = "Context window usage",
  className,
  ...props
}: ContextWindowGaugeProps) {
  const values = contextPartitionNames.map((name) => ({
    name,
    value: finiteTokens(partitions[name]),
  }));
  const total = values.reduce((sum, partition) => sum + partition.value, 0);
  const safeLimit = finiteTokens(limit);
  const percentage =
    safeLimit > 0 ? (total / safeLimit) * 100 : total > 0 ? 100 : 0;
  const state = quotaState(percentage);
  const progressMax = Math.max(safeLimit, 1);
  const progressValue = Math.min(total, progressMax);
  const totalForSegments = total || 1;

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-border bg-surface p-4 text-foreground",
        className,
      )}
      data-quota-state={state}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
            Context window
          </p>
          <p className="mt-1 text-sm font-medium">{label}</p>
        </div>
        <span
          className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[0.6875rem] font-medium text-primary"
          aria-label={`RTK savings ${savings}`}
        >
          RTK {savings}
        </span>
      </div>

      <Progress.Root
        className="relative h-3 w-full overflow-hidden rounded-full bg-muted outline-none ring-ring focus-visible:ring-2"
        value={progressValue}
        max={progressMax}
        aria-label={label}
        aria-valuetext={`${formatTokens(total)} of ${formatTokens(safeLimit)} tokens, ${Math.round(percentage)} percent, ${state}`}
        data-state={state}
      >
        <Progress.Indicator
          className="absolute inset-y-0 left-0 w-full origin-left animate-gauge-fill bg-foreground/5 motion-reduce:animate-none"
          style={{ transform: `scaleX(${Math.min(percentage, 100) / 100})` }}
        />
        <div className="absolute inset-0 flex" aria-hidden="true">
          {values.map(({ name, value }) => (
            <span
              key={name}
              className={cn(
                "h-full border-r border-background/70 last:border-r-0",
                partitionColors[name],
              )}
              style={{ width: `${(value / totalForSegments) * 100}%` }}
            />
          ))}
        </div>
      </Progress.Root>

      <div className="flex items-center justify-between gap-3 font-mono text-xs">
        <span className="text-muted-foreground">
          {formatTokens(total)} / {formatTokens(safeLimit)} tokens
        </span>
        <span className={cn("font-semibold uppercase", quotaColors[state])}>
          {Math.round(percentage)}% {state}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="list">
        {values.map(({ name, value }) => {
          const Icon = partitionIcons[name];
          return (
            <div
              key={name}
              className="min-w-0 rounded-md border border-border/70 bg-background/40 px-2 py-2"
              role="listitem"
            >
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate text-[0.6875rem] uppercase tracking-wide">
                  {partitionLabels[name]}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-foreground">
                {formatTokens(value)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
