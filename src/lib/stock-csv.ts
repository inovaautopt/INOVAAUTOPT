import Papa from "papaparse";
import { vehicleEditorInput, type VehicleEditorInput } from "./validation";

/**
 * Importação de stock por CSV. Funções puras (testadas em tests/unit/stock-csv.test.ts).
 * Identificação: SEMPRE pela referência interna do stand (coluna "referencia"); linhas sem
 * referência criam viaturas novas. Nunca se identifica uma viatura só por marca e modelo.
 */
export const CSV_COLUMNS = [
  "referencia", "estado", "marca", "modelo", "versao", "preco_eur", "iva", "ano", "mes", "km", "combustivel", "caixa", "carrocaria",
  "potencia_cv", "cilindrada_cc", "portas", "lugares", "tracao", "cor", "origem", "descricao", "garantia", "equipamento",
  "ev_autonomia_km", "ev_norma", "ev_bateria_kwh", "ev_carregamento", "ev_soh", "ev_fonte", "ev_data", "fotos",
] as const;

const MAP = {
  estado: { rascunho: "draft", disponivel: "available", disponível: "available", vendido: "sold", arquivado: "archived" },
  iva: { margem: "margin_scheme", dedutivel: "vat_included_deductible", dedutível: "vat_included_deductible", por_indicar: "unknown", "": "unknown" },
  combustivel: { gasolina: "gasoline", gasoleo: "diesel", gasóleo: "diesel", diesel: "diesel", hibrido: "hybrid", híbrido: "hybrid", hibrido_plugin: "plugin_hybrid", "híbrido plug-in": "plugin_hybrid", eletrico: "electric", elétrico: "electric", gpl: "lpg", outro: "other" },
  caixa: { manual: "manual", automatica: "automatic", automática: "automatic" },
  carrocaria: { citadino: "city", utilitario: "hatchback", utilitário: "hatchback", berlina: "sedan", carrinha: "wagon", suv: "suv", monovolume: "mpv", coupe: "coupe", coupé: "coupe", descapotavel: "convertible", descapotável: "convertible", "pick-up": "pickup", pickup: "pickup", comercial: "van", outro: "other" },
  tracao: { dianteira: "fwd", traseira: "rwd", integral: "awd", "4x4": "awd" },
  origem: { nacional: "national", importado: "imported" },
} as const;

function mapValue(kind: keyof typeof MAP, raw: string | undefined): { value: string | null; error?: string } {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "") return { value: kind === "iva" ? "unknown" : kind === "estado" ? "draft" : null };
  const m = (MAP[kind] as Record<string, string>)[v];
  return m ? { value: m } : { value: null, error: `${kind}: valor «${raw}» não reconhecido` };
}

export interface ParsedRow {
  line: number;
  reference: string | null;
  action: "create" | "update" | "skip";
  errors: string[];
  data: VehicleEditorInput | null;
  features: string[];
  photos: string[];
}

export function parseStockCsv(text: string): { rows: ParsedRow[]; headerErrors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim().toLowerCase(), delimitersToGuess: [";", ",", "\t"] });
  const headers = parsed.meta.fields ?? [];
  const headerErrors: string[] = [];
  for (const req of ["marca", "modelo"]) if (!headers.includes(req)) headerErrors.push(`Falta a coluna obrigatória «${req}».`);
  const unknown = headers.filter((h) => !(CSV_COLUMNS as readonly string[]).includes(h));
  if (unknown.length) headerErrors.push(`Colunas ignoradas: ${unknown.join(", ")}.`);
  if (parsed.data.length > 2000) headerErrors.push("Máximo de 2000 linhas por ficheiro.");
  const rows: ParsedRow[] = parsed.data.slice(0, 2000).map((r, i) => {
    const errors: string[] = [];
    const m = (k: keyof typeof MAP) => {
      const res = mapValue(k, r[k]);
      if (res.error) errors.push(res.error);
      return res.value;
    };
    const input = {
      make: r.marca ?? "",
      model: r.modelo ?? "",
      versionName: r.versao ?? "",
      status: m("estado"),
      branchId: "",
      priceEuros: r.preco_eur ?? "",
      vatRegime: m("iva"),
      firstRegistrationYear: r.ano ?? "",
      firstRegistrationMonth: r.mes ?? "",
      mileageKm: r.km ?? "",
      fuel: m("combustivel") ?? "",
      transmission: m("caixa") ?? "",
      bodyType: m("carrocaria") ?? "",
      powerHp: r.potencia_cv ?? "",
      engineCc: r.cilindrada_cc ?? "",
      doors: r.portas ?? "",
      seats: r.lugares ?? "",
      drivetrain: m("tracao") ?? "",
      color: r.cor ?? "",
      origin: m("origem") ?? "",
      evRangeKm: r.ev_autonomia_km ?? "",
      evRangeStandard: r.ev_norma ?? "",
      evBatteryKwh: r.ev_bateria_kwh ?? "",
      evCharging: r.ev_carregamento ?? "",
      evBatterySohPercent: r.ev_soh ?? "",
      evDataSource: r.ev_fonte ?? "",
      evDataDate: r.ev_data ?? "",
      historyFacts: [],
      description: r.descricao ?? "",
      warrantyText: r.garantia ?? "",
      videoUrl: "",
      isFeatured: false,
      featureIds: [],
      vin: "",
      plate: "",
      purchaseCostEuros: "",
      internalNotes: "",
    };
    const v = vehicleEditorInput.safeParse(input);
    if (!v.success) errors.push(...v.error.issues.map((iss) => `${iss.path.join(".") || "linha"}: ${iss.message}`));
    const reference = (r.referencia ?? "").trim().toUpperCase() || null;
    if (reference && !/^[A-Z0-9-]{2,20}$/.test(reference)) errors.push("referencia: formato inválido");
    const photos = (r.fotos ?? "").split("|").map((s) => s.trim()).filter(Boolean).slice(0, 30);
    const features = (r.equipamento ?? "").split("|").map((s) => s.trim()).filter(Boolean).slice(0, 100);
    return {
      line: i + 2,
      reference,
      action: errors.length ? "skip" : reference ? "update" : "create",
      errors,
      data: v.success ? v.data : null,
      features,
      photos,
    };
  });
  for (const e of parsed.errors.slice(0, 10)) headerErrors.push(`Linha ${(e.row ?? 0) + 2}: ${e.message}`);
  // referências repetidas no mesmo ficheiro
  const seen = new Map<string, number>();
  for (const row of rows) {
    if (!row.reference) continue;
    if (seen.has(row.reference)) {
      row.errors.push(`referencia repetida (linha ${seen.get(row.reference)})`);
      row.action = "skip";
    } else seen.set(row.reference, row.line);
  }
  return { rows, headerErrors };
}

export function templateCsv(): string {
  const example = [
    "", "rascunho", "Peugeot", "208", "1.2 PureTech Active", "16990", "margem", "2024", "2", "44832", "gasolina", "manual", "utilitario",
    "101", "1199", "5", "5", "dianteira", "Preto", "nacional", "Descrição da viatura", "", "Ar condicionado|Bluetooth|Cruise control",
    "", "", "", "", "", "", "", "",
  ];
  return "﻿" + [CSV_COLUMNS.join(";"), example.join(";")].join("\r\n") + "\r\n";
}
