import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/standard.css";
import "@fontsource-variable/archivo/standard-italic.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Inova Auto — viaturas usadas", template: "%s | Inova Auto" },
  description: "Stand Inova Auto: viaturas disponíveis, marcação de visitas, retomas e contactos.",
  applicationName: "Inova Auto",
  formatDetection: { telephone: false, email: false, address: false },
  icons: { icon: "/brand/inova-mark.svg" },
  openGraph: { type: "website", locale: "pt_PT", siteName: "Inova Auto" },
};

export const viewport: Viewport = {
  themeColor: "#161a1f",
  width: "device-width",
  initialScale: 1,
};

const THEME_SCRIPT = `try{var t=localStorage.getItem("inova-theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <head>
        {/* Aplica o tema (claro/escuro) antes de a página aparecer, para não piscar */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
