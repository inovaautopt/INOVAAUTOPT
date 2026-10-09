import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

/** GET /api/health — estado da aplicação e da base de dados. Sem segredos nem detalhes internos. */
export async function GET() {
  const started = Date.now();
  let database: "ok" | "error" = "ok";
  try {
    await sql()`select 1`;
  } catch {
    database = "error";
  }
  const ok = database === "ok";
  return NextResponse.json(
    { ok, database, latencyMs: Date.now() - started, version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local" },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
