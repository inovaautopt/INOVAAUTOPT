"use client";
import { Share2, Check } from "lucide-react";
import { useState } from "react";

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ title, url });
            return;
          } catch {
            /* partilha cancelada */
          }
        }
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          window.prompt("Copia a ligação:", url);
        }
      }}
    >
      {copied ? <Check aria-hidden className="h-4 w-4" /> : <Share2 aria-hidden className="h-4 w-4" />}
      {copied ? "Ligação copiada" : "Partilhar"}
    </button>
  );
}
