const channel = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

export const designSystemPreset = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        background: channel("background"),
        foreground: channel("foreground"),
        surface: channel("surface"),
        "surface-elevated": channel("surface-elevated"),
        border: channel("border"),
        input: channel("input"),
        muted: channel("muted"),
        "muted-foreground": channel("muted-foreground"),
        primary: channel("primary"),
        "primary-foreground": channel("primary-foreground"),
        accent: channel("accent"),
        "accent-foreground": channel("accent-foreground"),
        ring: channel("ring"),
        "oracle-blue": channel("oracle-blue"),
        "telemetry-violet": channel("telemetry-violet"),
        "agent-running": channel("agent-running"),
        "agent-idle": channel("agent-idle"),
        "agent-failed": channel("agent-failed"),
        "agent-blocked": channel("agent-blocked"),
        "agent-awaiting": channel("agent-awaiting"),
        "context-rules": channel("context-rules"),
        "context-memories": channel("context-memories"),
        "context-ast": channel("context-ast"),
        "context-active": channel("context-active"),
        "context-tools": channel("context-tools"),
        "quota-nominal": channel("quota-nominal"),
        "quota-warning": channel("quota-warning"),
        "quota-critical": channel("quota-critical"),
        "quota-overflow": channel("quota-overflow"),
      },
      spacing: {
        "2xs": "0.125rem",
        xs: "0.25rem",
      },
      fontFamily: {
        sans: ["Geist", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.45" },
        },
        "radar-sweep": {
          "0%": { opacity: "0.7", transform: "scale(0.65)" },
          "100%": { opacity: "0", transform: "scale(1.8)" },
        },
        "gauge-fill": {
          from: { transform: "scaleX(0)", "transform-origin": "left" },
          to: { transform: "scaleX(1)", "transform-origin": "left" },
        },
      },
      animation: {
        "pulse-slow": "pulse-slow 3s ease-in-out infinite",
        "radar-sweep": "radar-sweep 1.8s ease-out infinite",
        "gauge-fill": "gauge-fill 700ms ease-out both",
      },
    },
  },
};

export default designSystemPreset;
