import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://event7.pages.dev";
  const lastModified = new Date("2026-04-12");

  const docsPages = [
    "",
    "/getting-started",
    "/concepts",
    "/features",
    "/installation",
    "/catalog",
    "/asyncapi",
    "/validator",
    "/channels",
    "/governance-rules",
    "/references",
    "/ai-agent",
    "/api-reference",
    "/licensing",
    "/roadmap",
  ];

  return docsPages.map((page) => ({
    url: `${base}/docs${page}`,
    lastModified,
    changeFrequency: page === "" ? "weekly" : "monthly",
    priority: page === "" ? 1.0 : page === "/getting-started" || page === "/features" ? 0.9 : 0.7,
  }));
}
