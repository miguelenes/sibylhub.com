import { Button } from "@heroui/react";
import { createSkillsDocument, type SkillCatalog } from "@sibylhub/api-client";
import { useMemo, useState } from "react";

interface Props {
  catalog: SkillCatalog;
  catalogStatus: "ready" | "unavailable";
}

type SkillEntry = SkillCatalog["entries"][number];

interface SkillEntryRowProps {
  entry: SkillEntry;
  enabled: boolean;
  onToggle: (id: string) => void;
}

function SkillEntryRow({ entry, enabled, onToggle }: SkillEntryRowProps) {
  const eligible = entry.audited && entry.declarative;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/80 bg-background/40 p-3">
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold">{entry.id}</p>
        <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
          {entry.scope} · {entry.declarative ? "declarative" : "executable"} ·{" "}
          {entry.audited ? "audited" : "not audited"}
        </p>
      </div>
      <Button
        type="button"
        variant={enabled ? "primary" : "secondary"}
        isDisabled={!eligible}
        aria-pressed={enabled}
        onPress={() => onToggle(entry.id)}
      >
        {eligible ? (enabled ? "Enabled" : "Enable") : "Blocked"}
      </Button>
    </div>
  );
}

interface CatalogBodyProps {
  catalog: SkillCatalog;
  catalogStatus: "ready" | "unavailable";
  eligibleEntries: SkillEntry[];
  enabledIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
}

function CatalogBody({
  catalog,
  catalogStatus,
  eligibleEntries,
  enabledIds,
  onToggle,
}: CatalogBodyProps) {
  if (catalogStatus === "unavailable")
    return (
      <p
        className="mt-4 rounded-md border border-agent-blocked/30 bg-agent-blocked/10 p-3 text-sm text-agent-blocked"
        role="status"
      >
        No first-party audited Rosie or FastMCP source is configured. Skill
        enabling is disabled until validated source data exists.
      </p>
    );

  if (eligibleEntries.length === 0)
    return (
      <p
        className="mt-4 rounded-md border border-border/70 bg-background/40 p-3 text-sm text-muted-foreground"
        role="status"
      >
        The validated catalog contains no explicitly audited declarative
        entries.
      </p>
    );

  return (
    <div className="mt-4 grid gap-3">
      {catalog.entries.map((entry) => (
        <SkillEntryRow
          key={entry.id}
          entry={entry}
          enabled={enabledIds.has(entry.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

function exportMessage(
  exportState: "idle" | "ready" | "error",
  enabledCount: number,
) {
  if (exportState === "ready")
    return "Validated browser export created. The Worker did not mutate .agent/skills.json.";
  if (exportState === "error")
    return "The draft failed validation and was not exported.";
  if (enabledCount > 0)
    return `${enabledCount} local draft skill${enabledCount === 1 ? "" : "s"} selected.`;
  return "Toggles are browser-local until export or explicit CLI application.";
}

interface ExportControlsProps {
  draft: ReturnType<typeof createSkillsDocument>;
  enabledCount: number;
  exportState: "idle" | "ready" | "error";
  onExport: () => void;
}

function ExportControls({
  draft,
  enabledCount,
  exportState,
  onExport,
}: ExportControlsProps) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/70 pt-4">
      <Button
        type="button"
        isDisabled={!draft.valid || enabledCount === 0}
        onPress={onExport}
      >
        Export draft
      </Button>
      <span
        className="text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        {exportMessage(exportState, enabledCount)}
      </span>
    </div>
  );
}

export function FastMcpSkillCatalog({ catalog, catalogStatus }: Props) {
  const [enabledIds, setEnabledIds] = useState<string[]>([]);
  const [exportState, setExportState] = useState<"idle" | "ready" | "error">(
    "idle",
  );
  const eligibleEntries = useMemo(
    () => catalog.entries.filter((entry) => entry.audited && entry.declarative),
    [catalog.entries],
  );
  const enabledIdSet = useMemo(() => new Set(enabledIds), [enabledIds]);
  const draft = useMemo(
    () => createSkillsDocument(catalog, enabledIds),
    [catalog, enabledIds],
  );

  function toggleSkill(id: string) {
    setEnabledIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id].sort((left, right) => left.localeCompare(right)),
    );
    setExportState("idle");
  }

  async function exportDraft() {
    if (!draft.valid) {
      setExportState("error");
      return;
    }
    const payload = `${JSON.stringify(draft.data, null, 2)}\n`;
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = ".agent-skills.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setExportState("ready");
  }

  return (
    <section className="min-w-0 rounded-lg border border-border bg-surface p-4 text-foreground">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-muted-foreground">
            Catalog source
          </p>
          <p className="mt-1 break-all font-mono text-xs text-foreground">
            {catalog.sourceRevision}
          </p>
        </div>
        <span
          className="rounded-full border border-agent-blocked/40 bg-agent-blocked/10 px-2 py-1 font-mono text-[0.6875rem] font-semibold uppercase text-agent-blocked"
          role="status"
        >
          {catalogStatus}
        </span>
      </div>

      <CatalogBody
        catalog={catalog}
        catalogStatus={catalogStatus}
        eligibleEntries={eligibleEntries}
        enabledIds={enabledIdSet}
        onToggle={toggleSkill}
      />

      <ExportControls
        draft={draft}
        enabledCount={enabledIds.length}
        exportState={exportState}
        onExport={() => void exportDraft()}
      />
    </section>
  );
}
