import type { Metadata } from "next";
import { LegalRoute } from "@/components/site/LegalRoute";

export const metadata: Metadata = { title: "Reclamações e resolução de litígios", alternates: { canonical: "/reclamacoes" } };
export default function Page() {
  return <LegalRoute slug="reclamacoes" title="Reclamações e resolução de litígios" />;
}
