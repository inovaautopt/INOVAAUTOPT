import type { Metadata } from "next";
import { LegalRoute } from "@/components/site/LegalRoute";
import { CookieSettingsLink } from "@/components/consent/CookieSettingsLink";

export const metadata: Metadata = { title: "Política de cookies", alternates: { canonical: "/cookies" } };
export default function Page() {
  return (
    <LegalRoute slug="cookies" title="Política de cookies">
      <div className="mx-auto max-w-[90rem] px-4 md:px-6">
        <CookieSettingsLink className="btn btn-dark" />
      </div>
    </LegalRoute>
  );
}
