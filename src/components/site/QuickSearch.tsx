"use client";
import { useState } from "react";
import { Search } from "lucide-react";

const PRICE_STEPS = [5000, 7500, 10000, 12500, 15000, 20000, 25000, 30000, 40000, 50000];

export function QuickSearch({ makes, total }: { makes: { make: string; models: string[]; count: number }[]; total: number }) {
  const [make, setMake] = useState("");
  const models = makes.find((m) => m.make === make)?.models ?? [];
  return (
    <form action="/viaturas" method="get" role="search" aria-label="Pesquisar viaturas" className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
      <div>
        <label htmlFor="qs-marca" className="field-label">
          Marca
        </label>
        <select id="qs-marca" name="marca" className="input" value={make} onChange={(e) => setMake(e.target.value)}>
          <option value="">Todas as marcas</option>
          {makes.map((m) => (
            <option key={m.make} value={m.make}>
              {m.make} ({m.count})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="qs-modelo" className="field-label">
          Modelo
        </label>
        <select id="qs-modelo" name="modelo" className="input" disabled={!make} key={make}>
          <option value="">{make ? "Todos os modelos" : "Escolhe a marca"}</option>
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="qs-preco" className="field-label">
          Preço até
        </label>
        <select id="qs-preco" name="precoMax" className="input" defaultValue="">
          <option value="">Sem limite</option>
          {PRICE_STEPS.map((p) => (
            <option key={p} value={p}>
              {new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(p)}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn btn-primary h-11 sm:col-span-2 lg:col-span-1">
        <Search aria-hidden className="h-4 w-4" />
        Ver viaturas
        <span className="sr-only">({total} disponíveis)</span>
      </button>
    </form>
  );
}
