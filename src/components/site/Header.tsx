import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { getPublicSettings } from "@/lib/settings";
import { SERVICES } from "@/lib/domain";
import { HeaderTools, MobileMenu } from "./HeaderClient";

export async function Header() {
  const { company, services } = await getPublicSettings();
  const anyService = SERVICES.some((s) => services[s]);
  const nav = [
    { href: "/viaturas", label: "Viaturas" },
    ...(services.trade_in ? [{ href: "/retomas", label: "Retomas" }] : []),
    ...(anyService ? [{ href: "/servicos", label: "Serviços" }] : []),
    { href: "/sobre", label: "Sobre" },
    { href: "/contactos", label: "Contactos" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
        Saltar para o conteúdo
      </a>
      <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-2 px-4 md:px-6">
        <Link href="/" aria-label={`${company.tradeName} — página inicial`} className="flex-none">
          <Logo name={company.tradeName} />
        </Link>
        <nav aria-label="Principal" className="ml-6 hidden lg:block">
          <ul className="flex items-center gap-1">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-chrome-hi hover:text-ink">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-0 xs:gap-1">
          <HeaderTools />
          <MobileMenu nav={nav} />
        </div>
      </div>
    </header>
  );
}
