import {
  validateSkillCatalog,
  type ApiValidationIssue,
  type SkillCatalog,
} from "@sibylhub/api-client";

const emptyCatalog: SkillCatalog = {
  schemaVersion: "1.0",
  sourceRevision: "unconfigured",
  entries: [],
};

export type CatalogLoadResult =
  | { status: "ready"; catalog: SkillCatalog }
  | {
      status: "unavailable";
      catalog: SkillCatalog;
      issues: ApiValidationIssue[];
    };

export function loadSkillCatalog(input?: unknown): CatalogLoadResult {
  if (input === undefined)
    return {
      status: "unavailable",
      catalog: emptyCatalog,
      issues: [
        {
          path: "source",
          code: "unconfigured",
          message: "No audited declarative skill catalog is configured",
        },
      ],
    };
  const result = validateSkillCatalog(input);
  return result.valid
    ? { status: "ready", catalog: result.data }
    : { status: "unavailable", catalog: emptyCatalog, issues: result.issues };
}
