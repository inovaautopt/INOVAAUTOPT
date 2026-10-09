import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { getPublicSettings } from "@/lib/settings";
import { getBranches, summarizeHours } from "@/lib/branches";
import { callCostNote, formatPhone } from "@/lib/phone";
import { socialHandle } from "@/lib/format";
import { InstagramIcon } from "@/components/brand/InstagramIcon";
import { CookieSettingsLink } from "@/components/consent/CookieSettingsLink";

export async function Footer() {
  const [{ company, legal }, branches] = await Promise.all([getPublicSettings(), getBranches()]);
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 bg-ink text-chrome">
      <div className="mx-auto grid max-w-[90rem] gap-10 px-4 py-12 md:grid-cols-2 md:px-6 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo inverted name={company.tradeName} />
          {(company.legalName || company.nif) && (
            <p className="text-sm leading-relaxed">
              {company.legalName && <span className="block text-white">{company.legalName}</span>}
              {company.nif && <span className="block num">NIF {company.nif}</span>}
            </p>
          )}
        </div>

        {branches.map((b) => (
          <div key={b.id} className="space-y-3 text-sm">
            <h2 className="heading text-base text-white">{b.name}</h2>
            {b.addressLine && (
              <address className="not-italic leading-relaxed">
                {b.addressLine}
                <br />
                {[b.postalCode, b.city].filter(Boolean).join(" ")}
              </address>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {summarizeHours(b.openingHours).map((r) => (
                <div key={r.days} className="contents">
                  <dt className="font-semibold text-white">{r.days}</dt>
                  <dd className="num">{r.hours}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}

        <div className="space-y-2 text-sm">
          <h2 className="heading text-base text-white">Contactos</h2>
          <ul className="space-y-1.5">
            {company.phoneE164 && (
              <li>
                <a className="hover:text-white" href={`tel:${company.phoneE164}`}>
                  {formatPhone(company.phoneE164)}
                </a>
                {callCostNote(company.phoneE164) && <span className="block text-xs text-chrome/80">{callCostNote(company.phoneE164)}</span>}
              </li>
            )}
            {company.email && (
              <li>
                <a className="hover:text-white" href={`mailto:${company.email}`}>
                  {company.email}
                </a>
              </li>
            )}
            {company.instagramUrl && (
              <li>
                <a className="inline-flex items-center gap-2 hover:text-white" href={company.instagramUrl} rel="noopener noreferrer" target="_blank">
                  <InstagramIcon className="h-4 w-4" />
                  Instagram {socialHandle(company.instagramUrl)}
                </a>
              </li>
            )}
            {company.facebookUrl && (
              <li>
                <a className="hover:text-white" href={company.facebookUrl} rel="noopener noreferrer" target="_blank">
                  Facebook
                </a>
              </li>
            )}
            <li>
              <Link className="hover:text-white" href="/contactos">
                Todos os contactos e direções
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-2 text-sm">
          <h2 className="heading text-base text-white">Informação legal</h2>
          <ul className="space-y-1.5">
            <li>
              <Link className="hover:text-white" href="/privacidade">
                Política de privacidade
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/cookies">
                Política de cookies
              </Link>
            </li>
            <li>
              <CookieSettingsLink className="hover:text-white" />
            </li>
            <li>
              <Link className="hover:text-white" href="/termos">
                Termos de utilização
              </Link>
            </li>
            <li>
              <Link className="hover:text-white" href="/reclamacoes">
                Reclamações e resolução de litígios
              </Link>
            </li>
            {legal.complaintsBookUrl && (
              <li>
                <a className="hover:text-white" href={legal.complaintsBookUrl} rel="noopener noreferrer" target="_blank">
                  Livro de Reclamações Eletrónico
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-[90rem] px-4 py-5 text-xs md:px-6">
          © {year} {company.legalName ?? company.tradeName}. Preços com IVA incluído conforme indicado em cada viatura.
        </p>
      </div>
    </footer>
  );
}
