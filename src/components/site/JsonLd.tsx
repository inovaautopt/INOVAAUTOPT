import type { Company } from "@/lib/settings";
import type { Branch } from "@/lib/branches";
import type { VehicleDetail } from "@/lib/vehicles";
import { FUEL_LABEL, TRANSMISSION_LABEL } from "@/lib/domain";
import { mediaUrl } from "@/lib/storage-url";

/** Dados estruturados schema.org, sempre iguais aos dados visíveis na página. */
export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const DAY: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

export function dealerJsonLd(company: Company, branches: Branch[]) {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const b = branches.find((x) => !x.isDemo);
  if (!b) return null; // Sem morada real confirmada não publicamos AutoDealer
  return {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: company.tradeName,
    ...(company.legalName ? { legalName: company.legalName } : {}),
    ...(company.nif ? { vatID: `PT${company.nif}` } : {}),
    url: site,
    ...(company.phoneE164 ? { telephone: company.phoneE164 } : {}),
    ...(company.email ? { email: company.email } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: b.addressLine ?? undefined,
      postalCode: b.postalCode ?? undefined,
      addressLocality: b.city ?? undefined,
      addressCountry: "PT",
    },
    ...(b.latitude !== null && b.longitude !== null ? { geo: { "@type": "GeoCoordinates", latitude: b.latitude, longitude: b.longitude } } : {}),
    openingHoursSpecification: Object.entries(b.openingHours).flatMap(([day, intervals]) =>
      (intervals ?? []).map(([opens, closes]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DAY[day], opens, closes })),
    ),
    sameAs: [company.instagramUrl, company.facebookUrl].filter(Boolean),
  };
}

export function vehicleJsonLd(v: VehicleDetail, url: string, company: Company) {
  if (v.isDemo) return null;
  return {
    "@context": "https://schema.org",
    "@type": "Car",
    name: `${v.make} ${v.model}${v.versionName ? ` ${v.versionName}` : ""}`,
    brand: { "@type": "Brand", name: v.make },
    model: v.model,
    sku: v.reference,
    url,
    ...(v.media[0] ? { image: v.media.filter((m) => m.kind === "image").slice(0, 6).map((m) => mediaUrl(m.storagePath, 1600)) } : {}),
    ...(v.firstRegistrationYear ? { vehicleModelDate: String(v.firstRegistrationYear) } : {}),
    ...(v.mileageKm !== null ? { mileageFromOdometer: { "@type": "QuantitativeValue", value: v.mileageKm, unitCode: "KMT" } } : {}),
    ...(v.fuel ? { fuelType: FUEL_LABEL[v.fuel] } : {}),
    ...(v.transmission ? { vehicleTransmission: TRANSMISSION_LABEL[v.transmission] } : {}),
    ...(v.color ? { color: v.color } : {}),
    ...(v.doors ? { numberOfDoors: v.doors } : {}),
    ...(v.seats ? { seatingCapacity: v.seats } : {}),
    itemCondition: "https://schema.org/UsedCondition",
    ...(v.priceCents !== null
      ? {
          offers: {
            "@type": "Offer",
            price: (v.priceCents / 100).toFixed(2),
            priceCurrency: "EUR",
            availability: v.status === "sold" ? "https://schema.org/SoldOut" : v.status === "reserved" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock",
            seller: { "@type": "AutoDealer", name: company.tradeName },
          },
        }
      : {}),
  };
}
