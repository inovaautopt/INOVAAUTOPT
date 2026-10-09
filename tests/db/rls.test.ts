import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { asPublic, asStaff, asSystem, sql, type StaffClaims } from "@/lib/db";

/**
 * Testes de integração de RLS e regras de negócio contra Postgres real com as migrações.
 * Visitante (anon), vendedor, gestor de stock e administrador — incluindo tentativas
 * diretas de ler contactos, mensagens e dados privados.
 */
const ADMIN = "10000000-0000-4000-8000-000000000001";
const SALES = "10000000-0000-4000-8000-000000000002";
const SALES2 = "10000000-0000-4000-8000-000000000005";
const STOCK = "10000000-0000-4000-8000-000000000003";
const INACTIVE = "10000000-0000-4000-8000-000000000004";
const BRANCH = "20000000-0000-4000-8000-000000000001";
const V_PUB = "30000000-0000-4000-8000-000000000001";
const V_DRAFT = "30000000-0000-4000-8000-000000000002";

const admin: StaffClaims = { sub: ADMIN, aal: "aal2" };
const adminNoMfa: StaffClaims = { sub: ADMIN, aal: "aal1" };
const sales: StaffClaims = { sub: SALES, aal: "aal1" };
const sales2: StaffClaims = { sub: SALES2, aal: "aal1" };
const stock: StaffClaims = { sub: STOCK, aal: "aal1" };
const inactive: StaffClaims = { sub: INACTIVE, aal: "aal2" };

let leadMine: string;
let leadQueue: string;
let leadOther: string;

beforeAll(async () => {
  // auth.users é gerido pela Supabase Auth: nos testes é preenchido pelo dono da base
  const owner = postgres(process.env.DATABASE_URL!, { onnotice: () => {} });
  await owner`insert into auth.users (id, email) values (${ADMIN}, 'a@t'), (${SALES}, 's@t'), (${SALES2}, 's2@t'), (${STOCK}, 'k@t'), (${INACTIVE}, 'i@t')`;
  await owner.end();
  await asSystem(async (tx) => {
    await tx`insert into app.profiles (id, full_name, email, role, is_active) values
      (${ADMIN}, 'Admin', 'a@t', 'admin', true), (${SALES}, 'Vendedor', 's@t', 'sales', true), (${SALES2}, 'Vendedor 2', 's2@t', 'sales', true),
      (${STOCK}, 'Stock', 'k@t', 'stock_manager', true), (${INACTIVE}, 'Antigo', 'i@t', 'admin', false)`;
    await tx`update app.profiles set receives_leads = false where id in (${ADMIN}, ${STOCK})`;
    await tx`insert into app.branches (id, name, slug, opening_hours) values (${BRANCH}, 'Stand', 'stand', '{"mon":[["09:00","19:00"]]}')`;
    await tx`insert into app.vehicles (id, slug, status, branch_id, make, model, price_cents, vat_regime, first_registration_year, mileage_km, fuel, transmission)
             values (${V_PUB}, 'peugeot-208-a', 'available', ${BRANCH}, 'Peugeot', '208', 1699000, 'margin_scheme', 2024, 44832, 'gasoline', 'manual')`;
    await tx`insert into app.vehicles (id, slug, status, make, model) values (${V_DRAFT}, 'rascunho-b', 'draft', 'Fiat', '500')`;
    await tx`insert into app.vehicle_private_details (vehicle_id, vin, plate, purchase_cost_cents) values (${V_PUB}, 'VF3MRHNSUKS123456', 'AA-00-AA', 1200000)`;
    leadMine = ((await tx`insert into app.leads (kind, source, name, phone_e164, assigned_to, status) values ('info', 'website', 'Cliente A', '+351912345678', ${SALES}, 'assigned') returning id`) as unknown as { id: string }[])[0]!.id;
    leadQueue = ((await tx`insert into app.leads (kind, source, name, email) values ('info', 'website', 'Cliente B', 'b@example.com') returning id`) as unknown as { id: string }[])[0]!.id;
    leadOther = ((await tx`insert into app.leads (kind, source, name, email, assigned_to, status) values ('info', 'website', 'Cliente C', 'c@example.com', ${SALES2}, 'assigned') returning id`) as unknown as { id: string }[])[0]!.id;
    const [c] = (await tx`insert into app.conversations (contact_wa_id, contact_phone_e164) values ('351912345678', '+351912345678') returning id`) as unknown as { id: string }[];
    await tx`insert into app.messages (conversation_id, direction, body, status) values (${c!.id}, 'inbound', 'Olá', 'received')`;
  });
});

afterAll(async () => {
  await sql().end();
});

describe("visitante (anon)", () => {
  it("vê só viaturas publicadas", async () => {
    const rows = await asPublic((tx) => tx`select id from app.vehicles`);
    expect(rows.map((r) => r.id)).toEqual([V_PUB]);
  });
  it("não consegue ler colunas internas nem dados privados", async () => {
    await expect(asPublic((tx) => tx`select created_by from app.vehicles`)).rejects.toThrow(/permission denied/);
    await expect(asPublic((tx) => tx`select vin from app.vehicle_private_details`)).rejects.toThrow(/permission denied/);
  });
  it("não lista contactos, mensagens, conversas nem auditoria", async () => {
    for (const t of ["leads", "messages", "conversations", "audit_logs", "contact_permissions", "notification_outbox", "trade_in_media", "profiles"]) {
      await expect(asPublic((tx) => tx.unsafe(`select * from app.${t}`)), t).rejects.toThrow(/permission denied/);
    }
  });
  it("não escreve diretamente", async () => {
    await expect(asPublic((tx) => tx`insert into app.leads (kind, source, name, email) values ('info','website','X','x@x.pt')`)).rejects.toThrow(/permission denied/);
    await expect(asPublic((tx) => tx`update app.vehicles set price_cents = 1 where id = ${V_PUB}`)).rejects.toThrow(/permission denied/);
  });
});

describe("vendedor", () => {
  it("vê os seus contactos e a fila central, não os de colegas", async () => {
    const ids = (await asStaff(sales, (tx) => tx`select id from app.leads`)).map((r) => r.id);
    expect(ids).toContain(leadMine);
    expect(ids).toContain(leadQueue);
    expect(ids).not.toContain(leadOther);
  });
  it("sem autorização para a fila, só vê os seus", async () => {
    await asSystem((tx) => tx`update app.profiles set can_see_unassigned = false where id = ${SALES}`);
    const ids = (await asStaff(sales, (tx) => tx`select id from app.leads`)).map((r) => r.id);
    expect(ids).toEqual([leadMine]);
    await asSystem((tx) => tx`update app.profiles set can_see_unassigned = true where id = ${SALES}`);
  });
  it("não altera preços nem dados de viaturas", async () => {
    const r = await asStaff(sales, (tx) => tx`update app.vehicles set price_cents = 1 where id = ${V_PUB} returning id`);
    expect(r.length).toBe(0);
    const [v] = await asSystem((tx) => tx`select price_cents from app.vehicles where id = ${V_PUB}`);
    expect(v!.priceCents).toBe(1699000);
  });
  it("não vê dados privados da viatura", async () => {
    expect((await asStaff(sales, (tx) => tx`select vin from app.vehicle_private_details`)).length).toBe(0);
  });
  it("assume um contacto da fila só para si", async () => {
    await expect(asStaff(sales, (tx) => tx`update app.leads set assigned_to = ${SALES2} where id = ${leadQueue}`)).rejects.toThrow(/row-level security/);
    const r = await asStaff(sales, (tx) => tx`update app.leads set assigned_to = ${SALES} where id = ${leadQueue} returning id`);
    expect(r.length).toBe(1);
    await asSystem((tx) => tx`update app.leads set assigned_to = null where id = ${leadQueue}`);
  });
  it("não altera permissões nem utilizadores", async () => {
    const r = await asStaff(sales, (tx) => tx`update app.profiles set role = 'admin' where id = ${SALES} returning id`);
    expect(r.length).toBe(0);
  });
  it("vê a conversa WhatsApp sem responsável (fila) mas não escreve mensagens", async () => {
    expect((await asStaff(sales, (tx) => tx`select id from app.messages`)).length).toBe(1);
    await expect(asStaff(sales, (tx) => tx`insert into app.messages (conversation_id, direction, body) select id, 'outbound', 'x' from app.conversations`)).rejects.toThrow(/permission denied/);
  });
});

describe("gestor de stock", () => {
  it("gere viaturas e vê dados privados", async () => {
    const r = await asStaff(stock, (tx) => tx`update app.vehicles set price_cents = 1650000 where id = ${V_PUB} returning id`);
    expect(r.length).toBe(1);
    expect((await asStaff(stock, (tx) => tx`select vin from app.vehicle_private_details`)).length).toBe(1);
  });
  it("não vê contactos comerciais por defeito", async () => {
    expect((await asStaff(stock, (tx) => tx`select id from app.leads`)).length).toBe(0);
    expect((await asStaff(stock, (tx) => tx`select id from app.messages`)).length).toBe(0);
  });
  it("histórico de preço é registado com autor", async () => {
    const rows = await asStaff(stock, (tx) => tx`select old_price_cents, new_price_cents, changed_by from app.vehicle_price_history where vehicle_id = ${V_PUB} order by changed_at`);
    expect(rows.at(-1)).toMatchObject({ oldPriceCents: 1699000, newPriceCents: 1650000, changedBy: STOCK });
  });
});

describe("administrador", () => {
  it("com MFA vê tudo", async () => {
    expect((await asStaff(admin, (tx) => tx`select id from app.leads`)).length).toBe(3);
  });
  it("sem MFA (aal1) não tem privilégios de administrador", async () => {
    expect((await asStaff(adminNoMfa, (tx) => tx`select id from app.leads`)).length).toBe(0);
  });
  it("perfil desativado não vê nada", async () => {
    expect((await asStaff(inactive, (tx) => tx`select id from app.vehicles`)).length).toBe(0);
  });
  it("auditoria é só de leitura, mesmo para administradores", async () => {
    const before = (await asStaff(admin, (tx) => tx`select count(*)::int as n from app.audit_logs`))[0]!.n as number;
    expect(before).toBeGreaterThan(0);
    await expect(asStaff(admin, (tx) => tx`delete from app.audit_logs`)).rejects.toThrow(/permission denied/);
    await expect(asStaff(admin, (tx) => tx`insert into app.audit_logs (action, entity) values ('x', 'y')`)).rejects.toThrow(/permission denied/);
  });
  it("auditoria não guarda dados privados em claro", async () => {
    await asStaff(admin, (tx) => tx`update app.vehicle_private_details set vin = 'VF3MRHNSUKS999999' where vehicle_id = ${V_PUB}`);
    const [row] = await asSystem((tx) => tx`select data from app.audit_logs where entity = 'vehicle_private_details' order by id desc limit 1`);
    expect(JSON.stringify(row!.data)).not.toContain("999999");
  });
});

describe("regras de negócio na base de dados", () => {
  it("não publica viatura sem preço/IVA", async () => {
    await expect(asStaff(stock, (tx) => tx`update app.vehicles set status = 'available' where id = ${V_DRAFT}`)).rejects.toThrow(/preço/);
  });
  it("concorrência otimista: versão incrementa e update com versão antiga não afeta linhas", async () => {
    const [{ version }] = (await asSystem((tx) => tx`select version from app.vehicles where id = ${V_DRAFT}`)) as unknown as [{ version: number }];
    await asStaff(stock, (tx) => tx`update app.vehicles set color = 'Azul' where id = ${V_DRAFT} and version = ${version}`);
    const stale = await asStaff(stock, (tx) => tx`update app.vehicles set color = 'Verde' where id = ${V_DRAFT} and version = ${version} returning id`);
    expect(stale.length).toBe(0);
  });
  it("reserva transacional: uma só reserva ativa e viatura sai de disponível", async () => {
    await asStaff(sales, (tx) => tx`select app.reserve_vehicle(${V_PUB}, ${leadMine}, now() + interval '2 days', null)`);
    const [v] = await asSystem((tx) => tx`select status from app.vehicles where id = ${V_PUB}`);
    expect(v!.status).toBe("reserved");
    await expect(asStaff(sales2, (tx) => tx`select app.reserve_vehicle(${V_PUB}, null, now() + interval '2 days', null)`)).rejects.toThrow(/disponíveis/);
    // expirar reabre o stock
    await asSystem((tx) => tx`update app.vehicle_reservations set expires_at = now() - interval '1 minute' where vehicle_id = ${V_PUB} and status = 'active'`);
    await asSystem((tx) => tx`select app.expire_reservations()`);
    const [v2] = await asSystem((tx) => tx`select status from app.vehicles where id = ${V_PUB}`);
    expect(v2!.status).toBe("available");
  });
  it("vendida sai do stock público disponível mas a página continua acessível", async () => {
    await asStaff(stock, (tx) => tx`update app.vehicles set status = 'sold' where id = ${V_PUB}`);
    const rows = await asPublic((tx) => tx`select status, sold_at from app.vehicles where id = ${V_PUB}`);
    expect(rows[0]!.status).toBe("sold");
    expect(rows[0]!.soldAt).not.toBeNull();
    const available = await asPublic((tx) => tx`select id from app.vehicles where status in ('available', 'reserved')`);
    expect(available.length).toBe(0);
    await asStaff(stock, (tx) => tx`update app.vehicles set status = 'available' where id = ${V_PUB}`);
  });
  it("marcações confirmadas não se sobrepõem (viatura e vendedor)", async () => {
    const mk = () => asSystem(async (tx) => ((await tx`insert into app.appointments (lead_id, vehicle_id, kind, requested_date, requested_period) values (${leadMine}, ${V_PUB}, 'test_drive', current_date + 3, 'morning') returning id`) as unknown as { id: string }[])[0]!.id);
    const a1 = await mk();
    const a2 = await mk();
    const start = "2030-01-07T10:00:00Z";
    const end = "2030-01-07T11:00:00Z";
    await asStaff(sales, (tx) => tx`update app.appointments set status = 'confirmed', confirmed_start = ${start}, confirmed_end = ${end}, staff_id = ${SALES} where id = ${a1}`);
    await expect(
      asStaff(sales, (tx) => tx`update app.appointments set status = 'confirmed', confirmed_start = '2030-01-07T10:30:00Z', confirmed_end = '2030-01-07T11:30:00Z', staff_id = ${SALES} where id = ${a2}`),
    ).rejects.toThrow(/appointments_(vehicle|staff)_no_overlap/);
  });
  it("distribuição automática: round-robin, ausências e fila central", async () => {
    const newLead = () => asSystem(async (tx) => ((await tx`insert into app.leads (kind, source, name, email) values ('info', 'website', 'Novo', 'n@example.com') returning id`) as unknown as { id: string }[])[0]!.id);
    await asSystem((tx) => tx`update app.profiles set last_assigned_at = null`);
    const l1 = await newLead();
    const l2 = await newLead();
    const [r1] = await asSystem((tx) => tx`select app.auto_assign_lead(${l1}) as who`);
    const [r2] = await asSystem((tx) => tx`select app.auto_assign_lead(${l2}) as who`);
    expect(new Set([r1!.who, r2!.who])).toEqual(new Set([SALES, SALES2]));
    // ausência de um vendedor: o outro recebe
    await asSystem((tx) => tx`insert into app.staff_absences (profile_id, starts_on, ends_on) values (${SALES}, current_date - 1, current_date + 1)`);
    const l3 = await newLead();
    const [r3] = await asSystem((tx) => tx`select app.auto_assign_lead(${l3}) as who`);
    expect(r3!.who).toBe(SALES2);
    // ninguém disponível: fica na fila central
    await asSystem((tx) => tx`update app.profiles set receives_leads = false where id = ${SALES2}`);
    const l4 = await newLead();
    const [r4] = await asSystem((tx) => tx`select app.auto_assign_lead(${l4}) as who`);
    expect(r4!.who).toBeNull();
    await asSystem(async (tx) => {
      await tx`delete from app.staff_absences`;
      await tx`update app.profiles set receives_leads = true where id = ${SALES2}`;
    });
  });
  it("dados de demonstração são recusados em produção", async () => {
    await asSystem((tx) => tx`update app.instance set environment = 'production'`);
    await expect(asSystem((tx) => tx`insert into app.vehicles (slug, make, model, is_demo) values ('demo-x', 'Demo', 'X', true)`)).rejects.toThrow(/demonstração/);
    await asSystem((tx) => tx`update app.instance set environment = 'development'`);
  });
  it("outbox: dois processos não reclamam o mesmo trabalho", async () => {
    await asSystem((tx) => tx`insert into app.notification_outbox (kind, channel, payload, idempotency_key) select 'lead_received_staff', 'email', '{}', 'k' || g from generate_series(1, 6) g`);
    const [a, b] = await Promise.all([asSystem((tx) => tx`select id from app.claim_outbox(4)`), asSystem((tx) => tx`select id from app.claim_outbox(4)`)]);
    const ids = [...a, ...b].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(6);
    await expect(asSystem((tx) => tx`insert into app.notification_outbox (kind, channel, payload, idempotency_key) values ('x', 'email', '{}', 'k1')`)).rejects.toThrow(/duplicate key/);
  });
  it("limitação de pedidos partilhada", async () => {
    const hits = [];
    for (let i = 0; i < 4; i++) hits.push(((await asSystem((tx) => tx`select app.hit_rate_limit('teste', 60, 3) as ok`)) as unknown as { ok: boolean }[])[0]!.ok);
    expect(hits).toEqual([true, true, true, false]);
  });
});
