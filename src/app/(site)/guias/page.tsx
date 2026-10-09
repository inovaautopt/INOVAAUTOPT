import type { Metadata } from "next";
import Link from "next/link";
import { getGuides } from "@/lib/content";

export const metadata: Metadata = { title: "Guias", alternates: { canonical: "/guias" } };

export default async function GuidesPage() {
  const guides = await getGuides();
  return (
    <div className="mx-auto max-w-[90rem] px-4 py-10 md:px-6">
      <h1 className="display text-[2rem] xs:text-4xl md:text-5xl">Guias</h1>
      {guides.length === 0 ? (
        <p className="mt-6 text-ink-soft">Ainda não há guias publicados.</p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {guides.map((g) => (
            <li key={g.id} className="rounded-[var(--radius-md)] border border-line bg-surface p-5">
              <h2 className="heading text-xl">
                <Link href={`/guias/${g.slug.replace(/^guias\//, "")}`} className="hover:underline">
                  {g.title}
                </Link>
              </h2>
              {g.summary && <p className="mt-2 text-ink-soft">{g.summary}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
