import type { Metadata } from "next";
import Link from "next/link";
import { confirmAction } from "../actions";

export const metadata: Metadata = { title: "Confirmar alerta", robots: { index: false } };

/** A confirmação exige um clique (POST), para que leitores automáticos de email não confirmem sozinhos. */
export default async function ConfirmAlert(props: PageProps<"/alertas/confirmar">) {
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const estado = sp.estado;
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      {estado === "ok" ? (
        <>
          <h1 className="display text-3xl">Alerta confirmado.</h1>
          <p className="mt-3 text-ink-soft">Vamos enviar-te um email quando entrar uma viatura com os critérios que escolheste.</p>
        </>
      ) : estado === "erro" || !token ? (
        <>
          <h1 className="display text-3xl">Ligação inválida ou expirada.</h1>
          <p className="mt-3 text-ink-soft">Cria o alerta novamente a partir da pesquisa de viaturas.</p>
        </>
      ) : (
        <form action={confirmAction}>
          <h1 className="display text-3xl">Confirmar alerta de viaturas</h1>
          <input type="hidden" name="token" value={token} />
          <button className="btn btn-primary mt-6">Confirmar alerta</button>
        </form>
      )}
      <Link href="/viaturas" className="btn btn-outline mt-6">
        Ver viaturas
      </Link>
    </div>
  );
}
