import { useId } from "react";
import { cn } from "@/lib/cn";

/** Marca Inova Auto: emblema circular (silhueta SUV + iNA cromado + traço azul-aço) e logótipo. */
export function LogoMark({ className, title = "Inova Auto" }: { className?: string; title?: string }) {
  // IDs únicos: vários logótipos na mesma página (alguns ocultos) não podem partilhar gradientes
  const uid = useId().replace(/:/g, "");
  const chrome = `ia-chrome-${uid}`;
  const steel = `ia-steel-${uid}`;
  return (
    <svg viewBox="0 0 120 120" className={className} role={title ? "img" : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={chrome} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f9fb" />
          <stop offset="0.48" stopColor="#c9d0d9" />
          <stop offset="0.52" stopColor="#8e99a6" />
          <stop offset="1" stopColor="#e4e9ef" />
        </linearGradient>
        <linearGradient id={steel} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#3a5fa6" stopOpacity="0" />
          <stop offset="0.35" stopColor="#5d82c8" />
          <stop offset="1" stopColor="#9db6e6" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="60" fill="#161a1f" />
      <g fill="none" stroke={`url(#${chrome})`} strokeLinecap="round" strokeLinejoin="round">
        <path strokeWidth="2.4" d="M20 61c1-4 5-6 11-7l15-3 10-7c5-3 11-4.6 19-4.6l15 .4c6 .3 9.5 2 11 5l1.6 4.5c1 3 1 6-.4 8.6" />
        <path strokeWidth="1.6" d="M50 50.5l7.5-5.6c3-2 7-3 12-3.2l17.5-.1c3 0 5 1 6.2 3l1.8 4.6" />
        <path strokeWidth="1.4" d="M69.5 42v8.6M84.5 41.8l.8 8.4M49 51h46" />
        <path strokeWidth="2.4" d="M27.5 61.5a8.4 8.4 0 0 1 16.6 0M79.5 61.5a8.4 8.4 0 0 1 16.6 0" />
      </g>
      <path d="M18 100c26 4 52-2 82-30" fill="none" stroke={`url(#${steel})`} strokeWidth="3.4" strokeLinecap="round" />
      <g fill={`url(#${chrome})`}>
        <path d="M25.6 68.2h6.2l-1.4 5.2h-6.2z" />
        <path d="M23.2 76h6.2l-4.8 18h-6.2z" />
        <path d="M37.2 68h6.6l8.4 15.4L56.4 68h6.4l-6.9 26h-6.2l-8.8-15.6L36.6 94h-6.3z" />
        <path d="M77.2 68h7.4l7.6 26h-6.6l-5-18.6L69.4 94h-7z" />
      </g>
    </svg>
  );
}

export function Logo({ className, inverted = false, name = "Inova Auto" }: { className?: string; inverted?: boolean; name?: string }) {
  const [first, ...rest] = name.split(" ");
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-9 w-9 flex-none xs:h-10 xs:w-10" title="" />
      <span className={cn("leading-none", inverted ? "text-white" : "text-ink")}>
        <span className="block text-[1rem] font-extrabold italic tracking-tight xs:text-[1.15rem]" style={{ fontStretch: "120%" }}>
          {first}
          {rest.length > 0 && <span className={cn("font-semibold", inverted ? "text-chrome" : "text-muted")}> {rest.join(" ")}</span>}
        </span>
      </span>
    </span>
  );
}
