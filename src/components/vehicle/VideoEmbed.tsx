"use client";
import { PlayCircle } from "lucide-react";
import { useState } from "react";
import { useConsent, setPanelOpen } from "@/components/consent/consent-store";

function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube-nocookie\.com\/embed\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?rel=0`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?dnt=1`;
  return null;
}

/** Vídeo opcional: só carrega quando a pessoa pede e se autorizou conteúdos externos. */
export function VideoEmbed({ url, title, consentVersion }: { url: string; title: string; consentVersion: string }) {
  const consent = useConsent(consentVersion);
  const [play, setPlay] = useState(false);
  const src = embedUrl(url);
  if (!src) return null;
  if (play && consent?.external) {
    return <iframe src={`${src}&autoplay=1`} title={`Vídeo: ${title}`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className="aspect-video w-full rounded-[var(--radius-md)]" />;
  }
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] bg-ink p-4 text-center text-chrome">
      <PlayCircle aria-hidden className="h-12 w-12" />
      {consent?.external ? (
        <button type="button" className="btn btn-primary" onClick={() => setPlay(true)}>
          Ver vídeo
        </button>
      ) : (
        <>
          <p className="max-w-sm text-sm">O vídeo é carregado a partir de um serviço externo. Autoriza conteúdos externos ou abre-o diretamente.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setPanelOpen(true)}>
              Preferências de cookies
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm border-white/30 bg-transparent text-white">
              Abrir vídeo
            </a>
          </div>
        </>
      )}
    </div>
  );
}
