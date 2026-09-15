import type { HTMLAttributes, ReactNode } from "react";

export const contextPartitionNames = [
  "rules",
  "memories",
  "ast",
  "active",
  "tools",
] as const;

export type ContextPartitionName = (typeof contextPartitionNames)[number];

export type ContextPartitions = Record<ContextPartitionName, number>;

export interface ContextWindowGaugeProps extends HTMLAttributes<HTMLDivElement> {
  partitions: ContextPartitions;
  limit: number;
  savings?: string;
  label?: string;
}

export type AgentStatus =
  "running" | "idle" | "failed" | "blocked" | "awaiting";

export interface AgentStatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: AgentStatus;
  label?: string;
}

export interface TelemetryMetric {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}

export interface TelemetryCardProps extends HTMLAttributes<HTMLElement> {
  title: string;
  metrics: readonly TelemetryMetric[];
  children?: ReactNode;
}

export type StackInvariantState = "compliant" | "warning" | "violation";

export interface StackInvariantTagProps extends HTMLAttributes<HTMLSpanElement> {
  state: StackInvariantState;
  children: ReactNode;
}
