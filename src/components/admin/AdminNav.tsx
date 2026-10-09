"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Car, LayoutDashboard, Users, CalendarClock, MessageCircle, FileText, Upload, Settings, PlugZap, ScrollText, UserCog, Menu, X, LogOut, ExternalLink } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import type { StaffRole } from "@/lib/domain";
import { cn } from "@/lib/cn";

const ITEMS: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: StaffRole[] }[] = [
  { href: "/admin", label: "Resumo", icon: LayoutDashboard, roles: ["admin", "stock_manager", "sales"] },
  { href: "/admin/viaturas", label: "Viaturas", icon: Car, roles: ["admin", "stock_manager", "sales"] },
  { href: "/admin/contactos", label: "Contactos", icon: Users, roles: ["admin", "sales"] },
  { href: "/admin/visitas", label: "Visitas", icon: CalendarClock, roles: ["admin", "sales"] },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle, roles: ["admin", "sales"] },
  { href: "/admin/conteudo", label: "Conteúdo", icon: FileText, roles: ["admin", "stock_manager"] },
  { href: "/admin/importar", label: "Importar stock", icon: Upload, roles: ["admin", "stock_manager"] },
  { href: "/admin/configuracao", label: "Configuração", icon: Settings, roles: ["admin"] },
  { href: "/admin/utilizadores", label: "Utilizadores", icon: UserCog, roles: ["admin"] },
  { href: "/admin/integracoes", label: "Integrações", icon: PlugZap, roles: ["admin"] },
  { href: "/admin/auditoria", label: "Auditoria", icon: ScrollText, roles: ["admin"] },
];

export function AdminNav({ role, name, roleLabel, logout }: { role: StaffRole; name: string; roleLabel: string; logout: () => Promise<void> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = ITEMS.filter((i) => i.roles.includes(role));
  const nav = (
    <nav aria-label="Painel" className="flex flex-col gap-0.5 p-3">
      {items.map((i) => {
        const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-semibold", active ? "bg-white/10 text-white" : "text-chrome hover:bg-white/5 hover:text-white")}>
            <i.icon className="h-4 w-4" />
            {i.label}
          </Link>
        );
      })}
      <a href="/" target="_blank" className="mt-3 flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-sm text-chrome hover:text-white">
        <ExternalLink className="h-4 w-4" /> Ver o site
      </a>
    </nav>
  );
  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between bg-ink px-4 text-white lg:hidden">
        <span className="flex items-center gap-2 font-bold">
          <LogoMark className="h-8 w-8" title="" /> Painel
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Fechar menu" : "Abrir menu"} className="inline-flex h-10 w-10 items-center justify-center">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      <aside className={cn("bg-ink text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col", open ? "block" : "hidden lg:flex")}>
        <div className="hidden items-center gap-2 px-5 pb-2 pt-5 lg:flex">
          <LogoMark className="h-9 w-9" title="" />
          <span className="font-bold">Painel</span>
        </div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-white/10 p-4 text-sm">
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-chrome">{roleLabel}</p>
          <form action={logout}>
            <button className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-chrome hover:text-white">
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
