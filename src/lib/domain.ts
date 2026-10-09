/** Vocabulário do domínio, partilhado entre servidor e cliente. Rótulos em português de Portugal. */

export const VEHICLE_STATUSES = ["draft", "available", "reserved", "sold", "archived"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];
export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = {
  draft: "Rascunho",
  available: "Disponível",
  reserved: "Reservado",
  sold: "Vendido",
  archived: "Arquivado",
};

export const FUELS = ["gasoline", "diesel", "hybrid", "plugin_hybrid", "electric", "lpg", "other"] as const;
export type Fuel = (typeof FUELS)[number];
export const FUEL_LABEL: Record<Fuel, string> = {
  gasoline: "Gasolina",
  diesel: "Gasóleo",
  hybrid: "Híbrido",
  plugin_hybrid: "Híbrido plug-in",
  electric: "Elétrico",
  lpg: "GPL",
  other: "Outro",
};

export const TRANSMISSIONS = ["manual", "automatic"] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];
export const TRANSMISSION_LABEL: Record<Transmission, string> = { manual: "Manual", automatic: "Automática" };

export const BODY_TYPES = ["city", "hatchback", "sedan", "wagon", "suv", "mpv", "coupe", "convertible", "pickup", "van", "other"] as const;
export type BodyType = (typeof BODY_TYPES)[number];
export const BODY_TYPE_LABEL: Record<BodyType, string> = {
  city: "Citadino",
  hatchback: "Utilitário",
  sedan: "Berlina",
  wagon: "Carrinha",
  suv: "SUV / TT",
  mpv: "Monovolume",
  coupe: "Coupé",
  convertible: "Descapotável",
  pickup: "Pick-up",
  van: "Comercial",
  other: "Outro",
};

export const DRIVETRAINS = ["fwd", "rwd", "awd"] as const;
export type Drivetrain = (typeof DRIVETRAINS)[number];
export const DRIVETRAIN_LABEL: Record<Drivetrain, string> = {
  fwd: "Tração dianteira",
  rwd: "Tração traseira",
  awd: "Tração integral",
};

export const ORIGINS = ["national", "imported"] as const;
export type Origin = (typeof ORIGINS)[number];
export const ORIGIN_LABEL: Record<Origin, string> = { national: "Nacional", imported: "Importado" };

export const VAT_REGIMES = ["unknown", "vat_included_deductible", "margin_scheme"] as const;
export type VatRegime = (typeof VAT_REGIMES)[number];
export const VAT_LABEL: Record<VatRegime, string> = {
  unknown: "Por indicar",
  vat_included_deductible: "Preço com IVA incluído (IVA dedutível para empresas)",
  margin_scheme: "Preço final com IVA incluído (regime da margem, IVA não dedutível)",
};

export const FEATURE_GROUPS = ["comfort", "safety", "multimedia", "exterior", "interior", "other"] as const;
export type FeatureGroup = (typeof FEATURE_GROUPS)[number];
export const FEATURE_GROUP_LABEL: Record<FeatureGroup, string> = {
  comfort: "Conforto",
  safety: "Segurança",
  multimedia: "Multimédia",
  exterior: "Exterior",
  interior: "Interior",
  other: "Outros",
};

export const HISTORY_FACT_KEYS = ["owners", "service_history", "last_inspection", "no_accidents_declared", "warranty_until"] as const;
export type HistoryFactKey = (typeof HISTORY_FACT_KEYS)[number];
export const HISTORY_FACT_LABEL: Record<HistoryFactKey, string> = {
  owners: "Número de proprietários",
  service_history: "Histórico de manutenção",
  last_inspection: "Última inspeção",
  no_accidents_declared: "Sem acidentes declarados",
  warranty_until: "Garantia de fábrica até",
};

export interface HistoryFact {
  key: HistoryFactKey;
  value: string;
  source: string;
  verified_on: string; // AAAA-MM-DD
}

export const LEAD_STATUSES = ["new", "assigned", "contacted", "visit_scheduled", "proposal_sent", "won", "lost", "archived"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Novo",
  assigned: "Atribuído",
  contacted: "Em contacto",
  visit_scheduled: "Visita agendada",
  proposal_sent: "Proposta enviada",
  won: "Ganho",
  lost: "Perdido",
  archived: "Arquivado",
};

export const LEAD_KINDS = ["info", "visit", "trade_in", "financing", "whatsapp", "phone", "walk_in", "other"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];
export const LEAD_KIND_LABEL: Record<LeadKind, string> = {
  info: "Pedido de informação",
  visit: "Visita / test drive",
  trade_in: "Retoma",
  financing: "Financiamento",
  whatsapp: "WhatsApp",
  phone: "Telefone",
  walk_in: "Presencial",
  other: "Outro",
};

export const LEAD_SOURCES = ["website", "whatsapp", "phone", "walk_in", "email", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  website: "Site",
  whatsapp: "WhatsApp",
  phone: "Telefone",
  walk_in: "Presencial",
  email: "Email",
  other: "Outro",
};

export const APPOINTMENT_STATUS_LABEL = {
  requested: "Pedido (por confirmar)",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Realizada",
  no_show: "Não compareceu",
} as const;
export type AppointmentStatus = keyof typeof APPOINTMENT_STATUS_LABEL;

export const PERIOD_LABEL = { morning: "Manhã", afternoon: "Tarde" } as const;
export type Period = keyof typeof PERIOD_LABEL;

export const STAFF_ROLES = ["admin", "stock_manager", "sales"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Administrador",
  stock_manager: "Gestor de stock",
  sales: "Vendedor",
};

/** Serviços que o stand pode oferecer. Só aparecem no site quando confirmados no painel. */
export const SERVICES = ["trade_in", "financing", "delivery", "workshop", "import", "extended_warranty", "after_sales"] as const;
export type ServiceKey = (typeof SERVICES)[number];
export const SERVICE_LABEL: Record<ServiceKey, string> = {
  trade_in: "Retomas",
  financing: "Financiamento",
  delivery: "Entrega da viatura",
  workshop: "Oficina",
  import: "Importação por encomenda",
  extended_warranty: "Extensão de garantia",
  after_sales: "Apoio pós-venda",
};

export const SORTS = ["recent", "price_asc", "price_desc", "km_asc", "year_desc"] as const;
export type Sort = (typeof SORTS)[number];
export const SORT_LABEL: Record<Sort, string> = {
  recent: "Mais recentes",
  price_asc: "Preço mais baixo",
  price_desc: "Preço mais alto",
  km_asc: "Menos quilómetros",
  year_desc: "Ano mais recente",
};

export const NOT_STATED = "Não indicado";
