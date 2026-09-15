import type { Config } from "@docusaurus/types";

const config: Config = {
  title: "SibylHub platform",
  tagline: "Contracts for ecosystem knowledge",
  favicon: "img/favicon.ico",
  url: "https://sibylhub.com",
  baseUrl: "/",
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "throw",
  i18n: { defaultLocale: "en", locales: ["en"] },
  presets: [
    [
      "classic",
      {
        docs: { sidebarPath: "./sidebars.ts" },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      },
    ],
  ],
};

export default config;
