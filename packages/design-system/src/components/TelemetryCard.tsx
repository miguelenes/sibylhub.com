import { useId } from "react";
import { cn } from "../lib/cn";
import type { TelemetryCardProps } from "./types";

export function TelemetryCard({
  title,
  metrics,
  children,
  className,
  ...props
}: TelemetryCardProps) {
  const titleId = useId();

  return (
    <article
      className={cn(
        "rounded-lg border border-border bg-surface p-4 text-foreground",
        className,
      )}
      aria-labelledby={titleId}
      {...props}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-3">
        <h3
          id={titleId}
          className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
        >
          {title}
        </h3>
        <span
          className="size-1.5 rounded-full bg-oracle-blue shadow-[0_0_10px_hsl(var(--oracle-blue)/0.8)]"
          aria-hidden="true"
        />
      </div>

      {metrics.length > 0 ? (
        <dl className="grid gap-3 pt-3 sm:grid-cols-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0">
              <dt className="font-mono text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                {metric.label}
              </dt>
              <dd className="mt-1 break-words font-mono text-sm font-medium text-foreground">
                {metric.value}
              </dd>
              {metric.detail ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {metric.detail}
                </p>
              ) : null}
            </div>
          ))}
        </dl>
      ) : (
        <p
          className="pt-3 font-mono text-xs text-muted-foreground"
          role="status"
        >
          Awaiting telemetry data.
        </p>
      )}

      {children ? (
        <div className="mt-4 border-t border-border/70 pt-3">{children}</div>
      ) : null}
    </article>
  );
}
