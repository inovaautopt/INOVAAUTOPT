import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const production = process.env.APP_ENV === "production" && process.env.VERCEL_ENV !== "preview";
  if (!production) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/favoritos", "/comparar", "/alertas/"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
