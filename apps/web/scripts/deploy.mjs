if (
  !process.env.WRANGLER_ENV ||
  !["preview", "production"].includes(process.env.WRANGLER_ENV)
) {
  console.error(
    "Set WRANGLER_ENV to preview or production before an explicit deployment.",
  );
  process.exit(2);
}
console.error(
  "Deployment requires a separately reviewed target and is not run by local build or test tasks.",
);
process.exit(2);
