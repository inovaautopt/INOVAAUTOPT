import "server-only";
import postgres from "postgres";
import { env } from "./env";

/**
 * Acesso à base de dados.
 *
 * Três modos, sempre dentro de uma transação:
 *  - asPublic  → papel "anon". Usado nas páginas públicas. RLS só deixa ver dados publicados.
 *  - asStaff   → papel "authenticated" com as claims do colaborador verificado. RLS decide o acesso.
 *  - asSystem  → papel "service_role" (contorna RLS). Só para rotinas de confiança: gravar pedidos
 *                públicos já validados, processar a outbox, receber webhooks. Cada chamada deve
 *                fazer as suas próprias verificações de autorização.
 *
 * Em Vercel liga ao pooler de transações da Supabase (porta 6543) com prepare: false.
 */

type Sql = postgres.Sql<Record<string, unknown>>;
export type Tx = postgres.TransactionSql<Record<string, unknown>>;

const globalForDb = globalThis as unknown as { __inovaSql?: Sql };

export function sql(): Sql {
  if (!globalForDb.__inovaSql) {
    globalForDb.__inovaSql = postgres(env().DATABASE_URL, {
      prepare: false,
      max: env().DATABASE_POOL_MAX,
      idle_timeout: 20,
      connect_timeout: 10,
      // snake_case na base de dados ↔ camelCase no código (só nomes de colunas, não o conteúdo JSON)
      transform: { column: { from: postgres.toCamel, to: postgres.fromCamel } },
      types: {
        // bigint (cêntimos) como number: valores de viaturas cabem com folga em 2^53
        bigint: {
          to: 20,
          from: [20],
          serialize: (x: number | bigint) => x.toString(),
          parse: (x: string) => Number(x),
        },
      },
      onnotice: () => {},
    }) as unknown as Sql;
  }
  return globalForDb.__inovaSql;
}

export interface StaffClaims {
  sub: string;
  email?: string;
  aal: "aal1" | "aal2";
  sessionId?: string;
}

async function setRole(tx: Tx, role: "anon" | "authenticated" | "service_role", claims?: Record<string, unknown>) {
  await tx.unsafe(`set local role ${role}`);
  await tx`select set_config('request.jwt.claims', ${JSON.stringify(claims ?? { role })}, true)`;
  await tx`select set_config('statement_timeout', '15000', true)`;
}

export function asPublic<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return sql().begin(async (tx) => {
    await setRole(tx, "anon");
    return fn(tx);
  }) as Promise<T>;
}

export function asStaff<T>(claims: StaffClaims, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return sql().begin(async (tx) => {
    await setRole(tx, "authenticated", {
      sub: claims.sub,
      role: "authenticated",
      email: claims.email,
      aal: claims.aal,
      session_id: claims.sessionId,
    });
    return fn(tx);
  }) as Promise<T>;
}

export function asSystem<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return sql().begin(async (tx) => {
    await setRole(tx, "service_role");
    return fn(tx);
  }) as Promise<T>;
}

/** Erros da base de dados traduzidos para mensagens úteis. */
export function dbErrorMessage(err: unknown): string | null {
  if (err && typeof err === "object" && "code" in err) {
    const e = err as { code?: string; message?: string; constraint_name?: string };
    if (e.code === "23514" || e.code === "P0001") return e.message ?? "Dados inválidos.";
    if (e.code === "23505") return "Já existe um registo com estes dados.";
    if (e.code === "23P01") return "Já existe uma marcação confirmada nesse horário.";
    if (e.code === "42501") return "Não tens permissão para esta operação.";
    if (e.code === "02000" || e.code === "P0002") return e.message ?? "Registo não encontrado.";
  }
  return null;
}

export class ConflictError extends Error {
  constructor(message = "Este registo foi alterado por outra pessoa. Recarrega a página e tenta novamente.") {
    super(message);
    this.name = "ConflictError";
  }
}
