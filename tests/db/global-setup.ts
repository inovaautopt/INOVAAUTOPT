import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Cria uma base de testes limpa com o shim Supabase + todas as migrações. */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/inova_test");
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Testes de base de dados só em localhost.");
  const name = url.pathname.slice(1);
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { onnotice: () => {} });
  await admin.unsafe(`drop database if exists "${name}" with (force)`);
  await admin.unsafe(`create database "${name}"`);
  await admin.end();
  const sql = postgres(url.toString(), { onnotice: () => {} });
  const root = path.resolve(__dirname, "../..");
  await sql.unsafe(readFileSync(path.join(root, "db/local-supabase-shim.sql"), "utf8"));
  for (const f of readdirSync(path.join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    await sql.unsafe(readFileSync(path.join(root, "supabase/migrations", f), "utf8"));
  }
  await sql.end();
}
