import { Ban, CircleDot, CircleX, Clock3, LoaderCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../lib/cn";
import type { AgentStatus, AgentStatusBadgeProps } from "./types";

const statusConfig: Record<
  AgentStatus,
  { label: string; icon: LucideIcon; tone: string; pulse: boolean }
> = {
  running: {
    label: "Running",
    icon: LoaderCircle,
    tone: "border-agent-running/35 bg-agent-running/10 text-agent-running",
    pulse: true,
  },
  idle: {
    label: "Idle",
    icon: CircleDot,
    tone: "border-agent-idle/35 bg-agent-idle/10 text-agent-idle",
    pulse: false,
  },
  failed: {
    label: "Failed",
    icon: CircleX,
    tone: "border-agent-failed/35 bg-agent-failed/10 text-agent-failed",
    pulse: false,
  },
  blocked: {
    label: "Blocked",
    icon: Ban,
    tone: "border-agent-blocked/35 bg-agent-blocked/10 text-agent-blocked",
    pulse: false,
  },
  awaiting: {
    label: "Awaiting",
    icon: Clock3,
    tone: "border-agent-awaiting/35 bg-agent-awaiting/10 text-agent-awaiting",
    pulse: true,
  },
};

export function AgentStatusBadge({
  status,
  label,
  className,
  ...props
}: AgentStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const resolvedLabel = label ?? config.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[0.6875rem] font-medium uppercase tracking-wide",
        config.tone,
        className,
      )}
      data-status={status}
      role="status"
      aria-label={`Agent status: ${resolvedLabel}`}
      {...props}
    >
      <span className="relative flex size-3.5 items-center justify-center">
        {config.pulse ? (
          <span
            className="absolute size-3.5 rounded-full bg-current/40 animate-radar-sweep motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
        <Icon
          className={cn(
            "relative size-3.5",
            status === "running" && "animate-spin motion-reduce:animate-none",
          )}
          aria-hidden="true"
        />
      </span>
      <span>{resolvedLabel}</span>
    </span>
  );
}
