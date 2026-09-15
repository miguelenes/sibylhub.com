import { ShieldCheck, ShieldX, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import type { StackInvariantTagProps, StackInvariantState } from "./types";

const stateConfig: Record<
  StackInvariantState,
  { label: string; icon: LucideIcon; tone: string }
> = {
  compliant: {
    label: "Compliant",
    icon: ShieldCheck,
    tone: "border-agent-running/35 bg-agent-running/10 text-agent-running",
  },
  warning: {
    label: "Review",
    icon: TriangleAlert,
    tone: "border-agent-blocked/35 bg-agent-blocked/10 text-agent-blocked",
  },
  violation: {
    label: "Violation",
    icon: ShieldX,
    tone: "border-agent-failed/35 bg-agent-failed/10 text-agent-failed",
  },
};

export function StackInvariantTag({
  state,
  children,
  className,
  ...props
}: StackInvariantTagProps) {
  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[0.6875rem] font-medium",
        config.tone,
        className,
      )}
      data-state={state}
      role="status"
      aria-label={`${config.label}: ${typeof children === "string" ? children : "stack invariant"}`}
      {...props}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  );
}
