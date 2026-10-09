import { getPageForDisplay } from "@/lib/content";
import { isProduction } from "@/lib/env";
import { getPublicSettings } from "@/lib/settings";
import { ContentPage, LegalUnavailable } from "./ContentPage";

export async function LegalRoute({ slug, title, children }: { slug: string; title: string; children?: React.ReactNode }) {
  const page = await getPageForDisplay(slug, isProduction());
  if (!page) {
    const { company } = await getPublicSettings();
    return <LegalUnavailable email={company.privacyEmail ?? company.email} />;
  }
  return (
    <>
      <ContentPage slug={slug} fallbackTitle={title} />
      {children}
    </>
  );
}
