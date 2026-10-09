import type { Metadata } from "next";
import { LegalRoute } from "@/components/site/LegalRoute";

export const metadata: Metadata = { title: "Termos de utilização", alternates: { canonical: "/termos" } };
export default function Page() {
  return <LegalRoute slug="termos" title="Termos de utilização" />;
}
