import { StackInvariantTag, TelemetryCard } from "@sibylhub/design-system";
import type {
  DependencyAuditRecord,
  DependencyPolicyState,
} from "@sibylhub/api-client";

interface Props {
  dependencies: DependencyAuditRecord[];
  auditStatus: "ready" | "unavailable";
  sourceRevision?: string;
}

const stateLabels: Record<DependencyPolicyState, string> = {
  compliant: "Compliant",
  warning: "Warning",
  violation: "Violation",
  unconfigured: "Unconfigured",
  unavailable: "Unavailable",
};

function formatPurl(purl: NonNullable<DependencyAuditRecord["purl"]>) {
  const namespace = purl.namespace ? `${purl.namespace}/` : "";
  const qualifiers = purl.qualifiers
    ? `?${Object.entries(purl.qualifiers)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join("&")}`
    : "";
  const subpath = purl.subpath ? `#${purl.subpath}` : "";
  return `pkg:${purl.type}/${namespace}${purl.name}@${purl.version}${qualifiers}${subpath}`;
}

export function DependencyAuditView({
  dependencies,
  auditStatus,
  sourceRevision,
}: Props) {
  if (auditStatus === "unavailable")
    return (
      <TelemetryCard title="Policy evidence unavailable" metrics={[]}>
        <p className="text-sm text-agent-blocked" role="status">
          The configured dependency snapshot is unavailable. No dependency is
          represented as compliant from missing evidence.
        </p>
      </TelemetryCard>
    );

  return (
    <ul
      className="grid gap-4 xl:grid-cols-2"
      aria-label="Dependency policy evidence"
    >
      {dependencies.length === 0 ? (
        <TelemetryCard title="No dependency evidence" metrics={[]}>
          <p className="text-sm text-muted-foreground" role="status">
            No precomputed dependency evidence is configured for this snapshot.
          </p>
        </TelemetryCard>
      ) : null}
      {dependencies.map((dependency) => {
        const evidenceIsCurrent =
          dependency.evidence.length > 0 &&
          (!sourceRevision || dependency.snapshotRevision === sourceRevision);
        const effectivePolicy: DependencyPolicyState =
          dependency.policy === "compliant" && !evidenceIsCurrent
            ? "unconfigured"
            : !evidenceIsCurrent && dependency.policy === "warning"
              ? "unavailable"
              : dependency.policy;
        const tagState =
          effectivePolicy === "compliant" ||
          effectivePolicy === "warning" ||
          effectivePolicy === "violation"
            ? effectivePolicy
            : null;
        return (
          <li
            key={dependency.id}
            className="min-w-0 rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-base font-semibold text-foreground">
                  {dependency.packageName}
                </h3>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {dependency.version}
                </p>
              </div>
              {tagState ? (
                <StackInvariantTag state={tagState}>
                  {stateLabels[effectivePolicy]}
                </StackInvariantTag>
              ) : (
                <span className="shrink-0 rounded-md border border-agent-blocked/40 bg-agent-blocked/10 px-2 py-1 font-mono text-[0.6875rem] font-semibold uppercase text-agent-blocked">
                  {stateLabels[effectivePolicy]}
                </span>
              )}
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="font-mono text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                  Runtime
                </dt>
                <dd className="mt-1 break-words text-foreground">
                  {dependency.runtime ?? "Not configured"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="font-mono text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                  Package manager
                </dt>
                <dd className="mt-1 break-words text-foreground">
                  {dependency.packageManager ?? "Not configured"}
                </dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="font-mono text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                  Evidence
                </dt>
                <dd className="mt-1 break-words text-foreground">
                  {dependency.evidence.length > 0
                    ? dependency.evidence.join(" · ")
                    : "No approved evidence"}
                </dd>
              </div>
              {dependency.purl ? (
                <div className="min-w-0 sm:col-span-2">
                  <dt className="font-mono text-[0.6875rem] uppercase tracking-wide text-muted-foreground">
                    Package URL
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs text-foreground">
                    {formatPurl(dependency.purl)}
                  </dd>
                </div>
              ) : null}
            </dl>
            {dependency.invariant ? (
              <div className="mt-4 rounded-md border border-agent-blocked/30 bg-agent-blocked/10 p-3 text-sm">
                <p className="font-semibold text-foreground">
                  Invariant: {dependency.invariant.name}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Severity: {dependency.invariant.severity}
                </p>
                <p className="mt-1 break-words text-muted-foreground">
                  {dependency.invariant.reason}
                </p>
                {dependency.invariant.approvedReplacement ? (
                  <p className="mt-2 break-words text-foreground">
                    Approved replacement:{" "}
                    {dependency.invariant.approvedReplacement}
                  </p>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
