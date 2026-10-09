import { cn } from "@/lib/cn";

/**
 * Placa ao estilo da matrícula portuguesa: banda azul UE com "P", referência interna ao centro
 * e banda amarela com o ano/mês da primeira matrícula (como nas matrículas reais).
 * Mostra a REFERÊNCIA do stand, nunca a matrícula verdadeira da viatura.
 */
export function Plate({
  reference,
  year,
  month,
  size = "md",
  className,
}: {
  reference: string;
  year: number | null;
  month: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const s = {
    sm: { h: "h-6", text: "text-[0.7rem]", band: "w-3.5", yb: "w-6 text-[0.5rem]" },
    md: { h: "h-8", text: "text-sm", band: "w-5", yb: "w-8 text-[0.6rem]" },
    lg: { h: "h-11", text: "text-lg", band: "w-7", yb: "w-11 text-xs" },
  }[size];
  return (
    <span
      className={cn("inline-flex items-stretch overflow-hidden rounded-[4px] border border-ink/70 bg-white font-bold num", s.h, className)}
      aria-label={`Referência ${reference}${year ? `, primeira matrícula ${month ? `${month}/` : ""}${year}` : ""}`}
    >
      <span aria-hidden className={cn("flex flex-col items-center justify-end bg-plate-blue pb-0.5 text-white", s.band)}>
        <span className="text-[0.55em] leading-none">P</span>
      </span>
      <span aria-hidden className={cn("flex items-center px-2 tracking-[0.08em] text-ink", s.text)} style={{ fontStretch: "112%" }}>
        {reference}
      </span>
      {year ? (
        <span aria-hidden className={cn("flex flex-col items-center justify-center bg-plate-yellow leading-[1.05] text-ink", s.yb)}>
          <span>{String(year).slice(-2)}</span>
          {month ? <span>{String(month).padStart(2, "0")}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
