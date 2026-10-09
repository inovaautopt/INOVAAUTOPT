import type { Metadata } from "next";
import { LegalRoute } from "@/components/site/LegalRoute";

export const metadata: Metadata = { title: "Política de privacidade", alternates: { canonical: "/privacidade" } };
export default function Page() {
  return <LegalRoute slug="privacidade" title="Política de privacidade" />;
}
