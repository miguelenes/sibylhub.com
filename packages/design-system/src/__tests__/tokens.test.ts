import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import designSystemPreset from "@sibylhub/design-system/tailwind";

const require = createRequire(import.meta.url);
const tokenPath = require.resolve("@sibylhub/design-system/tokens");
const tokenCss = readFileSync(tokenPath, "utf8");

describe("public design-system contracts", () => {
  it("publishes strict space-separated HSL channels", () => {
    const requestedTokens = [
      "--background: 230 24% 5%;",
      "--surface: 222 24% 7%;",
      "--border: 220 13% 18%;",
      "--oracle-blue: 199 89% 48%;",
      "--telemetry-violet: 265 89% 66%;",
      "--agent-running: 142 71% 45%;",
      "--agent-idle: 215 16% 47%;",
      "--agent-failed: 0 84% 60%;",
      "--agent-blocked: 38 92% 50%;",
      "--agent-awaiting: 190 90% 50%;",
      "--context-rules: 270 70% 60%;",
      "--context-memories: 217 91% 60%;",
      "--context-ast: 186 100% 42%;",
      "--context-active: 45 93% 47%;",
      "--context-tools: 142 71% 45%;",
      "--quota-nominal-max: 70;",
      "--quota-warning-max: 85;",
      "--quota-critical-max: 95;",
    ];

    for (const token of requestedTokens) expect(tokenCss).toContain(token);
    expect(tokenCss).not.toMatch(/hsl\([^)]*,/);
    expect(tokenCss).toContain("prefers-reduced-motion: reduce");
  });

  it("exposes the Tailwind 3-compatible semantic preset", () => {
    const theme = designSystemPreset.theme.extend;

    expect(theme.spacing).toMatchObject({ "2xs": "0.125rem", xs: "0.25rem" });
    expect(theme.fontFamily).toMatchObject({
      sans: expect.arrayContaining(["Geist", "Inter"]),
      mono: expect.arrayContaining(["Geist Mono", "JetBrains Mono"]),
    });
    expect(theme.colors).toMatchObject({
      "oracle-blue": "hsl(var(--oracle-blue) / <alpha-value>)",
      "agent-running": "hsl(var(--agent-running) / <alpha-value>)",
      "quota-overflow": "hsl(var(--quota-overflow) / <alpha-value>)",
    });
    expect(theme.animation).toMatchObject({
      "pulse-slow": expect.any(String),
      "radar-sweep": expect.any(String),
      "gauge-fill": expect.any(String),
    });
  });
});
