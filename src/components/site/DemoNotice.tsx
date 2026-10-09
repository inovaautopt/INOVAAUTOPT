import { isProduction } from "@/lib/env";

/** Faixa visível fora de produção: deixa claro que o conteúdo pode ser de demonstração. */
export function DemoNotice() {
  if (isProduction()) return null;
  return (
    <div className="bg-plate-yellow px-4 py-1.5 text-center text-xs font-semibold text-ink">
      Ambiente de testes — viaturas e dados marcados como «Demonstração» não são reais.
    </div>
  );
}
