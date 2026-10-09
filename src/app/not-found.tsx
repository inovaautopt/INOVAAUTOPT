import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-xl flex-col items-start justify-center gap-4 px-4">
      <p className="tag">Erro 404</p>
      <h1 className="display text-4xl">Esta página não existe.</h1>
      <p className="text-ink-soft">Pode ter sido removida ou a ligação está incompleta. Se procuravas uma viatura, ela pode já ter saído do stock.</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/viaturas" className="btn btn-primary">
          Ver viaturas disponíveis
        </Link>
        <Link href="/" className="btn btn-outline">
          Página inicial
        </Link>
      </div>
    </main>
  );
}
