import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DependencyAuditRecord, SkillCatalog } from "@sibylhub/api-client";
import { ContextObservatory } from "./ContextObservatory";
import { DependencyAuditView } from "./DependencyAuditView";
import { FastMcpSkillCatalog } from "./FastMcpSkillCatalog";
import { MemoryGraphViewer } from "./MemoryGraphViewer";
import { getLocalProjectContext } from "../lib/fixtures";

describe("cockpit islands", () => {
  it("renders the initial context snapshot and all five partition percentages", () => {
    const markup = renderToStaticMarkup(
      <ContextObservatory
        context={getLocalProjectContext()}
        displayStatus="degraded"
      />,
    );

    expect(markup).toContain('aria-label="Context partition percentages"');
    expect(markup).toContain("Rules");
    expect(markup).toContain("Memories");
    expect(markup).toContain("AST");
    expect(markup).toContain("Active");
    expect(markup).toContain("Tools");
    expect(markup).toContain("RTK -74.2%");
    expect(markup).toContain("Default value");
  });

  it("keeps the memory prompt stable in server-rendered output", () => {
    const markup = renderToStaticMarkup(
      <MemoryGraphViewer projectId="local-project" />,
    );

    expect(markup).toContain('for="memory-query"');
    expect(markup).toContain('id="memory-query"');
    expect(markup).toContain("Submit a bounded query");
    expect(markup).toContain("Search memory");
    expect(markup).not.toContain("Searching approved metadata");
  });

  it("fails closed for stale dependency evidence and renders invariant detail", () => {
    const stale: DependencyAuditRecord = {
      id: "stale-dependency",
      packageName: "stale-package",
      version: "1.0.0",
      runtime: "typescript",
      packageManager: "pnpm",
      evidence: ["old snapshot"],
      snapshotRevision: "old-revision",
      policy: "compliant",
    };
    const violation: DependencyAuditRecord = {
      id: "violating-dependency",
      packageName: "violating-package",
      version: "2.0.0",
      evidence: ["policy snapshot"],
      snapshotRevision: "current-revision",
      policy: "violation",
      invariant: {
        name: "approved-runtime",
        severity: "high",
        reason: "The package runtime is not approved.",
        approvedReplacement: "approved-package",
      },
    };
    const markup = renderToStaticMarkup(
      <DependencyAuditView
        dependencies={[stale, violation]}
        auditStatus="ready"
        sourceRevision="current-revision"
      />,
    );

    expect(markup).toContain("Unconfigured");
    expect(markup).not.toContain("Compliant");
    expect(markup).toContain("Invariant: approved-runtime");
    expect(markup).toContain("Severity: high");
    expect(markup).toContain("Approved replacement: approved-package");
  });

  it("exposes only audited declarative skill toggles and blocks the rest", () => {
    const catalog: SkillCatalog = {
      schemaVersion: "1.0",
      sourceRevision: "catalog-fixture",
      entries: [
        {
          id: "audited-skill",
          scope: "workspace",
          declarative: true,
          audited: true,
        },
        {
          id: "blocked-skill",
          scope: "workspace",
          declarative: false,
          audited: true,
        },
      ],
    };
    const markup = renderToStaticMarkup(
      <FastMcpSkillCatalog catalog={catalog} catalogStatus="ready" />,
    );

    expect(markup).toContain("audited-skill");
    expect(markup).toContain("blocked-skill");
    expect(markup).toContain("Blocked");
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain("Toggles are browser-local");
  });
});
