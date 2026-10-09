import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const gaEnabled = Boolean(process.env.NEXT_PUBLIC_GA4_ID);
const pixelEnabled = Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID);
const deployEnv = process.env.APP_ENV ?? "development";

// Content Security Policy. Scripts de terceiros só são carregados depois do consentimento
// (ver src/components/consent), mas os domínios têm de estar autorizados aqui.
const scriptSrc = ["'self'", "'unsafe-inline'"];
const connectSrc = ["'self'"];
const imgSrc = ["'self'", "data:", "blob:"];
if (isDev) scriptSrc.push("'unsafe-eval'");
if (supabaseUrl) {
  imgSrc.push(supabaseUrl);
  connectSrc.push(supabaseUrl);
}
if (gaEnabled) {
  scriptSrc.push("https://www.googletagmanager.com");
  connectSrc.push("https://*.google-analytics.com", "https://*.analytics.google.com", "https://www.googletagmanager.com");
  imgSrc.push("https://*.google-analytics.com", "https://www.googletagmanager.com");
}
if (pixelEnabled) {
  scriptSrc.push("https://connect.facebook.net");
  connectSrc.push("https://www.facebook.com");
  imgSrc.push("https://www.facebook.com");
}

const csp = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src ${imgSrc.join(" ")}`,
  "font-src 'self'",
  `connect-src ${connectSrc.join(" ")}`,
  // Mapa e vídeos incorporados só depois de consentimento; domínios autorizados:
  "frame-src https://www.google.com https://www.youtube-nocookie.com https://player.vimeo.com",
  "media-src 'self' blob:" + (supabaseUrl ? ` ${supabaseUrl}` : ""),
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // As fotografias são redimensionadas e convertidas no carregamento (sharp), por isso não
  // dependemos da otimização de imagens da plataforma.
  images: { unoptimized: true },
  serverExternalPackages: ["sharp", "postgres"],
  async headers() {
    const headers = [{ source: "/:path*", headers: securityHeaders }];
    // Pré-visualizações e staging nunca são indexadas
    if (deployEnv !== "production" || process.env.VERCEL_ENV === "preview") {
      headers.push({ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] });
    }
    headers.push({
      source: "/admin/:path*",
      headers: [
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Cache-Control", value: "no-store" },
      ],
    });
    return headers;
  },
};

export default nextConfig;
