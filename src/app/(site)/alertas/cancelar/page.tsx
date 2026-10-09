import type { Metadata } from "next";
import Link from "next/link";
import { cancelAction } from "../actions";

export const metadata: Metadata = { title: "Cancelar alerta", robots: { index: false } };

export default async function CancelAlert(props: PageProps<"/alertas/cancelar">) {
  const sp = await props.searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const estado = sp.estado;
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      {estado === "ok" ? (
        <h1 className="display text-3xl">Alerta cancelado. Não vais receber mais emails deste alerta.</h1>
      ) : estado === "erro" || !token ? (
        <h1 className="display text-3xl">Este alerta já estava cancelado ou a ligação é inválida.</h1>
      ) : (
        <form action={cancelAction}>
          <h1 className="display text-3xl">Cancelar alerta de viaturas</h1>
          <input type="hidden" name="token" value={token} />
          <button className="btn btn-dark mt-6">Cancelar alerta</button>
        </form>
      )}
      <Link href="/viaturas" className="btn btn-outline mt-6">
        Ver viaturas
      </Link>
    </div>
  );
}
