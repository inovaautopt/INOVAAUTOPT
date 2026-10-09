"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-xl flex-col items-start justify-center gap-4 px-4">
      <h1 className="display text-4xl">Algo correu mal.</h1>
      <p className="text-ink-soft">Não conseguimos carregar esta página. Tenta novamente dentro de momentos.</p>
      <button type="button" className="btn btn-primary" onClick={() => reset()}>
        Tentar novamente
      </button>
    </main>
  );
}
