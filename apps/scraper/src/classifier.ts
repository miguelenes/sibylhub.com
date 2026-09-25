import type { CandidateDetection } from "@sibylhub/schemas";
import type { PackageDetails } from "./adapters.js";

type Rule = {
  name: string;
  patterns: string[];
  kind: "framework" | "category";
};

export const classifierVersion = "catalog-1";

const frameworkRules: Array<[string, string[]]> = [
  ["React", ["react"]],
  ["Vue", ["vue"]],
  ["Angular", ["angular"]],
  ["Svelte", ["svelte"]],
  ["Hono", ["hono"]],
  ["Express", ["express"]],
  ["Laravel", ["laravel"]],
  ["Symfony", ["symfony"]],
  ["WordPress", ["wordpress", "wp-"]],
  ["FastAPI", ["fastapi"]],
  ["Django", ["django"]],
  ["Flask", ["flask"]],
  ["Axum", ["axum"]],
  ["Tokio", ["tokio"]],
  ["Actix", ["actix"]],
  ["SQLx", ["sqlx"]],
  ["Serde", ["serde"]],
];
const categoryRules: Array<[string, string[]]> = [
  [
    "ORM",
    [
      "orm",
      "prisma",
      "sequelize",
      "typeorm",
      "sqlalchemy",
      "diesel",
      "eloquent",
    ],
  ],
  ["Migration runner", ["migration", "alembic", "flyway", "liquibase"]],
  [
    "HTTP framework",
    ["http-framework", "web-framework", "express", "fastapi", "hono", "axum"],
  ],
  ["Validation", ["validation", "validator", "zod", "pydantic", "joi"]],
  ["Testing", ["test", "testing", "vitest", "jest", "pytest"]],
  ["Linter", ["lint", "linter", "eslint", "ruff", "clippy"]],
  ["Builder", ["build", "builder", "webpack", "vite", "rollup", "esbuild"]],
  ["State management", ["state", "redux", "zustand", "pinia"]],
];
const rules: Rule[] = [
  ...frameworkRules.map(([name, patterns]) => ({
    name,
    patterns,
    kind: "framework" as const,
  })),
  ...categoryRules.map(([name, patterns]) => ({
    name,
    patterns,
    kind: "category" as const,
  })),
];

function hasPattern(
  value: string,
  patterns: string[],
): { matched: boolean; exact: boolean } {
  const normalized = value.toLowerCase();
  const exact = patterns.some((pattern) => normalized === pattern);
  return {
    matched: exact || patterns.some((pattern) => normalized.includes(pattern)),
    exact,
  };
}

export function classifyPackageDetails(
  details: PackageDetails,
): CandidateDetection[] {
  if (!details.evidenceIds.length) return [];
  const packageName = details.packageName.toLowerCase();
  const keywords = (details.keywords ?? []).map((value) => value.toLowerCase());
  const dependencies = (details.dependencies ?? []).map((value) =>
    value.toLowerCase(),
  );
  const observations = (details.observations ?? []).map((value) =>
    String(value.value).toLowerCase(),
  );
  const text = [
    packageName,
    ...keywords,
    ...dependencies,
    ...observations,
  ].join(" ");
  return rules.flatMap((rule) => {
    const packageMatch = hasPattern(packageName, rule.patterns);
    const metadataMatch = hasPattern(text, rule.patterns);
    if (!metadataMatch.matched) return [];
    const confidence = packageMatch.exact
      ? "high"
      : packageMatch.matched
        ? "medium"
        : "low";
    return [
      {
        kind: rule.kind,
        name: rule.name,
        confidence,
        classifierVersion,
        rationale: packageMatch.matched
          ? "Matched package name against the versioned classifier catalog"
          : "Matched declared metadata against the versioned classifier catalog",
        evidenceIds: [...details.evidenceIds],
      } satisfies CandidateDetection,
    ];
  });
}
