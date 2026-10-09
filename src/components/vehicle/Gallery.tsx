"use client";
/* eslint-disable @next/next/no-img-element -- variantes WebP pré-geradas com dimensões fixas */
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { mediaSrcSet, mediaUrl } from "@/lib/storage-url";
import { VehicleImage } from "./VehicleImage";

interface Item {
  id: string;
  storagePath: string;
  altText: string | null;
}

export function Gallery({ items, title }: { items: Item[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const count = items.length;

  const go = useCallback((delta: number) => setIndex((i) => (count ? (i + delta + count) % count : 0)), [count]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (zoomOpen && !d.open) d.showModal();
    if (!zoomOpen && d.open) d.close();
  }, [zoomOpen]);

  if (count === 0) return <VehicleImage path={null} alt={title} sizes="100vw" className="rounded-[var(--radius-lg)]" />;
  const current = items[index]!;
  const alt = (it: Item, i: number) => it.altText ?? `${title} — fotografia ${i + 1} de ${count}`;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    }
  };
  const swipe = {
    onTouchStart: (e: React.TouchEvent) => {
      touchX.current = e.touches[0]?.clientX ?? null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (touchX.current === null) return;
      const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
      if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      touchX.current = null;
    },
  };

  return (
    <section aria-roledescription="galeria" aria-label={`Fotografias de ${title}`} onKeyDown={onKey}>
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-ink" {...swipe}>
        <img
          key={current.id}
          src={mediaUrl(current.storagePath, 960)}
          srcSet={mediaSrcSet(current.storagePath)}
          sizes="(min-width: 1024px) 60vw, 100vw"
          alt={alt(current, index)}
          width={1600}
          height={1200}
          fetchPriority={index === 0 ? "high" : "auto"}
          className="aspect-[4/3] w-full object-cover"
        />
        {count > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink hover:bg-white" aria-label="Fotografia anterior">
              <ChevronLeft aria-hidden className="h-6 w-6" />
            </button>
            <button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink hover:bg-white" aria-label="Fotografia seguinte">
              <ChevronRight aria-hidden className="h-6 w-6" />
            </button>
          </>
        )}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <span className="rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold text-white num" aria-live="polite">
            {index + 1} / {count}
          </span>
          <button type="button" onClick={() => setZoomOpen(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/90 px-3 text-xs font-semibold text-ink hover:bg-white">
            <Expand aria-hidden className="h-4 w-4" /> Ampliar
          </button>
        </div>
      </div>

      {count > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Miniaturas">
          {items.map((it, i) => (
            <li key={it.id} className="flex-none">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver fotografia ${i + 1}`}
                aria-current={i === index}
                className={`block overflow-hidden rounded-[var(--radius-sm)] border-2 ${i === index ? "border-brand" : "border-transparent opacity-80 hover:opacity-100"}`}
              >
                <img src={mediaUrl(it.storagePath, 480)} alt="" width={96} height={72} loading="lazy" className="h-[54px] w-[72px] object-cover sm:h-[72px] sm:w-24" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        onClose={() => {
          setZoomOpen(false);
          setZoomed(false);
        }}
        aria-label="Fotografia ampliada"
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-ink p-0 text-white backdrop:bg-ink"
        onKeyDown={onKey}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 flex-none items-center justify-between px-4">
            <span className="text-sm num">
              {index + 1} / {count}
            </span>
            <button type="button" onClick={() => setZoomOpen(false)} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10" aria-label="Fechar">
              <X aria-hidden className="h-6 w-6" />
            </button>
          </div>
          <div className={`relative flex-1 ${zoomed ? "overflow-auto" : "overflow-hidden"}`} {...swipe}>
            <img
              src={mediaUrl(current.storagePath, 1600)}
              alt={alt(current, index)}
              onClick={() => setZoomed((z) => !z)}
              className={zoomed ? "max-w-none cursor-zoom-out" : "h-full w-full cursor-zoom-in object-contain"}
              style={zoomed ? { width: "200%" } : undefined}
            />
          </div>
          {count > 1 && (
            <div className="flex flex-none justify-center gap-3 p-3">
              <button type="button" onClick={() => go(-1)} className="btn btn-outline border-white/30 bg-transparent text-white">
                <ChevronLeft aria-hidden className="h-5 w-5" /> Anterior
              </button>
              <button type="button" onClick={() => go(1)} className="btn btn-outline border-white/30 bg-transparent text-white">
                Seguinte <ChevronRight aria-hidden className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </dialog>
    </section>
  );
}
