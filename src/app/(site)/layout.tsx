import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { Analytics } from "@/components/consent/Analytics";
import { getPublicSettings } from "@/lib/settings";
import { DemoNotice } from "@/components/site/DemoNotice";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { legal } = await getPublicSettings();
  const ga4Id = process.env.NEXT_PUBLIC_GA4_ID || undefined;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID || undefined;
  return (
    <>
      <DemoNotice />
      <Header />
      <main id="conteudo" className="min-h-[60vh]">
        {children}
      </main>
      <Footer />
      <ConsentBanner version={legal.consentVersion} analyticsAvailable={Boolean(ga4Id)} marketingAvailable={Boolean(pixelId)} />
      <Analytics version={legal.consentVersion} ga4Id={ga4Id} pixelId={pixelId} />
    </>
  );
}
