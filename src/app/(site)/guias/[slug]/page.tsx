import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/site/ContentPage";
import { getPublishedPage } from "@/lib/content";

export async function generateMetadata(props: PageProps<"/guias/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await getPublishedPage(`guias/${slug}`);
  return page ? { title: page.title, description: page.summary ?? undefined, alternates: { canonical: `/guias/${slug}` } } : { title: "Guia não encontrado", robots: { index: false } };
}

export default async function GuidePage(props: PageProps<"/guias/[slug]">) {
  const { slug } = await props.params;
  if (!/^[a-z0-9-]+$/.test(slug)) notFound();
  const page = await getPublishedPage(`guias/${slug}`);
  if (!page || page.kind !== "guide") notFound();
  return <ContentPage slug={`guias/${slug}`} fallbackTitle={page.title} />;
}
