"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Heart, GitCompareArrows, Menu, Moon, Sun, X } from "lucide-react";
import { useList } from "@/lib/local-lists";

function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-brand px-1 text-[0.65rem] font-bold text-white num">
      {n}
    </span>
  );
}

/** Alterna entre tema claro e escuro; a escolha fica guardada neste navegador. */
function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    // Sincroniza com o tema aplicado pelo script do <head> (só existe no navegador)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);
  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("inova-theme", next);
    } catch {
      /* navegação privada: a escolha vale só para esta página */
    }
    setDark(!dark);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="relative inline-flex h-11 w-10 items-center justify-center rounded-full hover:bg-chrome-hi xs:w-11"
      aria-label={dark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={dark ? "Tema claro" : "Tema escuro"}
    >
      {dark ? <Sun aria-hidden className="h-5 w-5" /> : <Moon aria-hidden className="h-5 w-5" />}
    </button>
  );
}

export function HeaderTools() {
  const fav = useList("favorites").length;
  const cmp = useList("compare").length;
  return (
    <>
      <ThemeToggle />
      <Link href="/favoritos" className="relative inline-flex h-11 w-10 items-center justify-center rounded-full hover:bg-chrome-hi xs:w-11" aria-label={`Favoritos (${fav})`}>
        <Heart aria-hidden className="h-5 w-5" />
        <Count n={fav} />
      </Link>
      <Link href="/comparar" className="relative inline-flex h-11 w-10 items-center justify-center rounded-full hover:bg-chrome-hi xs:w-11" aria-label={`Comparador (${cmp})`}>
        <GitCompareArrows aria-hidden className="h-5 w-5" />
        <Count n={cmp} />
      </Link>
    </>
  );
}

export function MobileMenu({ nav }: { nav: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Fecha ao navegar
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button type="button" className="inline-flex h-11 w-10 items-center justify-center rounded-full hover:bg-chrome-hi xs:w-11" aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu aria-hidden className="h-6 w-6" />
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        aria-label="Menu"
        className="m-0 ml-auto h-dvh max-h-none w-[min(22rem,100vw)] max-w-none bg-surface p-0 backdrop:bg-ink/50"
      >
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <span className="heading">Menu</span>
          <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-chrome-hi" aria-label="Fechar menu" onClick={() => setOpen(false)}>
            <X aria-hidden className="h-6 w-6" />
          </button>
        </div>
        <nav aria-label="Menu móvel">
          <ul className="p-2">
            {[...nav, { href: "/favoritos", label: "Favoritos" }, { href: "/comparar", label: "Comparador" }].map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="block rounded-[var(--radius-sm)] px-4 py-3.5 text-lg font-semibold hover:bg-chrome-hi" aria-current={pathname === n.href ? "page" : undefined}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </dialog>
    </div>
  );
}
