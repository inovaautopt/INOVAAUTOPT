import type { Metadata } from "next";
import { CompareTable } from "@/components/vehicle/SavedLists";

export const metadata: Metadata = { title: "Comparar viaturas", robots: { index: false, follow: true } };

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 md:px-6">
      <h1 className="display text-[2rem] xs:text-4xl md:text-5xl">Comparar</h1>
      <p className="mt-2 max-w-[60ch] text-ink-soft">Até 4 viaturas lado a lado. As linhas com valores diferentes ficam destacadas.</p>
      <div className="mt-6">
        <CompareTable />
      </div>
    </div>
  );
}
