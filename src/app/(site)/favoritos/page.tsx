import type { Metadata } from "next";
import { FavoritesList } from "@/components/vehicle/SavedLists";

export const metadata: Metadata = { title: "Favoritos", robots: { index: false, follow: true } };

export default function FavoritesPage() {
  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8 md:px-6">
      <h1 className="display text-[2rem] xs:text-4xl md:text-5xl">Favoritos</h1>
      <p className="mt-2 max-w-[60ch] text-ink-soft">Mostramos o estado atual de cada viatura: se entretanto foi reservada ou vendida, vês isso aqui.</p>
      <div className="mt-6">
        <FavoritesList />
      </div>
    </div>
  );
}
