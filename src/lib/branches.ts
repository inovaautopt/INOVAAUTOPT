import "server-only";
import { cache } from "react";
import { asPublic } from "./db";
import { isProduction } from "./env";

export type OpeningHours = Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", [string, string][]>>;

export interface Branch {
  id: string;
  name: string;
  slug: string;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  phoneE164: string | null;
  email: string | null;
  openingHours: OpeningHours;
  mapsUrl: string | null;
  isDemo: boolean;
}

export const getBranches = cache(async (): Promise<Branch[]> => {
  try {
    return await asPublic(async (tx) => {
      const rows = (await tx`
        select id, name, slug, address_line, postal_code, city, latitude::float8 as latitude, longitude::float8 as longitude,
               phone_e164, email, opening_hours, maps_url, is_demo
        from app.branches where is_active ${isProduction() ? tx`and not is_demo` : tx``}
        order by name`) as unknown as Branch[];
      return rows;
    });
  } catch (err) {
    console.error("Falha a ler instalações", (err as Error).message);
    return [];
  }
});

export const WEEKDAYS: { key: keyof OpeningHours; label: string; short: string }[] = [
  { key: "mon", label: "Segunda-feira", short: "Seg" },
  { key: "tue", label: "Terça-feira", short: "Ter" },
  { key: "wed", label: "Quarta-feira", short: "Qua" },
  { key: "thu", label: "Quinta-feira", short: "Qui" },
  { key: "fri", label: "Sexta-feira", short: "Sex" },
  { key: "sat", label: "Sábado", short: "Sáb" },
  { key: "sun", label: "Domingo", short: "Dom" },
];

/** Agrupa dias com o mesmo horário: "Seg–Sex 09:30–13:00, 14:30–19:00". */
export function summarizeHours(h: OpeningHours): { days: string; hours: string }[] {
  const rows: { days: string[]; hours: string }[] = [];
  for (const d of WEEKDAYS) {
    const intervals = h[d.key] ?? [];
    const text = intervals.length ? intervals.map(([a, b]) => `${a}–${b}`).join(", ") : "Encerrado";
    const last = rows[rows.length - 1];
    if (last && last.hours === text) last.days.push(d.short);
    else rows.push({ days: [d.short], hours: text });
  }
  return rows.map((r) => ({ days: r.days.length > 2 ? `${r.days[0]}–${r.days[r.days.length - 1]}` : r.days.join(", "), hours: r.hours }));
}

export function directionsUrl(b: Pick<Branch, "latitude" | "longitude" | "addressLine" | "postalCode" | "city" | "mapsUrl">): string | null {
  if (b.mapsUrl) return b.mapsUrl;
  if (b.latitude !== null && b.longitude !== null) return `https://www.google.com/maps/dir/?api=1&destination=${b.latitude},${b.longitude}`;
  const addr = [b.addressLine, b.postalCode, b.city].filter(Boolean).join(", ");
  return addr ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}` : null;
}
