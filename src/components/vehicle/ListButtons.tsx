"use client";
import { Heart, GitCompareArrows, Check } from "lucide-react";
import { useState } from "react";
import { toggleInList, useList, COMPARE_MAX } from "@/lib/local-lists";
import { cn } from "@/lib/cn";

export function FavoriteButton({ id, label, className, withText = false }: { id: string; label: string; className?: string; withText?: boolean }) {
  const list = useList("favorites");
  const active = list.includes(id);
  return (
    <button
      type="button"
      onClick={() => toggleInList("favorites", id)}
      aria-pressed={active}
      aria-label={active ? `Remover ${label} dos favoritos` : `Guardar ${label} nos favoritos`}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full transition-colors",
        withText ? "btn btn-outline rounded-[var(--radius-sm)]" : "h-10 w-10 bg-white/95 text-ink hover:bg-white",
        className,
      )}
    >
      <Heart aria-hidden className={cn("h-5 w-5", active && "fill-danger text-danger")} />
      {withText && <span>{active ? "Nos favoritos" : "Guardar"}</span>}
    </button>
  );
}

export function CompareButton({ id, label, className }: { id: string; label: string; className?: string }) {
  const list = useList("compare");
  const active = list.includes(id);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={() => {
          const r = toggleInList("compare", id);
          setMsg(r.full ? `Podes comparar até ${COMPARE_MAX} viaturas. Remove uma no comparador.` : null);
        }}
        aria-pressed={active}
        aria-label={active ? `Remover ${label} do comparador` : `Adicionar ${label} ao comparador`}
        className={cn("btn btn-outline btn-sm", active && "border-brand text-brand-ink", className)}
      >
        {active ? <Check aria-hidden className="h-4 w-4" /> : <GitCompareArrows aria-hidden className="h-4 w-4" />}
        {active ? "A comparar" : "Comparar"}
      </button>
      <span role="status" className="text-xs text-danger">
        {msg}
      </span>
    </span>
  );
}
