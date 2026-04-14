import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/docs/",
      disallow: ["/api/", "/schemas", "/catalog", "/channels", "/asyncapi", "/rules", "/validate", "/references", "/ai", "/settings", "/login", "/signup"],
    },
    sitemap: "https://event7.pages.dev/sitemap.xml",
  };
}
