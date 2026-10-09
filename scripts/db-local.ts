/**
 * Base de dados LOCAL para desenvolvimento e testes (sem Supabase).
 *   npm run db:local              → recria a base local e aplica shim + migrações
 *   npm run db:local -- --seed-demo → idem + dados de demonstração e colaboradores de teste
 *
 * Recusa-se a correr contra qualquer host que não seja localhost.
 */
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { seedDemoMedia } from "./demo-media";

const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/inova_dev";
const parsed = new URL(url);
if (!["localhost", "127.0.0.1"].includes(parsed.hostname)) {
  console.error(`Recusado: db:local só funciona com localhost (recebido ${parsed.hostname}).`);
  process.exit(1);
}
const dbName = parsed.pathname.slice(1);
const seedDemo = process.argv.includes("--seed-demo");
const root = path.resolve(__dirname, "..");

async function main() {
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { onnotice: () => {} });
  await admin.unsafe(`drop database if exists "${dbName}" with (force)`);
  await admin.unsafe(`create database "${dbName}"`);
  await admin.end();

  const sql = postgres(url, { onnotice: () => {} });
  const files = [path.join(root, "db/local-supabase-shim.sql"), ...readdirSync(path.join(root, "supabase/migrations")).filter((f) => f.endsWith(".sql")).sort().map((f) => path.join(root, "supabase/migrations", f))];
  for (const f of files) {
    await sql.unsafe(readFileSync(f, "utf8"));
    console.log(`✓ ${path.relative(root, f)}`);
  }
  if (seedDemo) {
    await sql.unsafe(readFileSync(path.join(root, "db/demo-seed.sql"), "utf8"));
    console.log("✓ db/demo-seed.sql");
    // Colaboradores de teste (só com AUTH_PROVIDER=dev): admin e vendedor
    await sql`insert into auth.users (id, email) values
      ('00000000-0000-4000-8000-00000000a001', 'admin@demo.local'),
      ('00000000-0000-4000-8000-00000000a002', 'vendedor@demo.local'),
      ('00000000-0000-4000-8000-00000000a003', 'stock@demo.local') on conflict do nothing`;
    await sql`insert into app.profiles (id, full_name, email, role) values
      ('00000000-0000-4000-8000-00000000a001', 'Admin Demonstração', 'admin@demo.local', 'admin'),
      ('00000000-0000-4000-8000-00000000a002', 'Vendedor Demonstração', 'vendedor@demo.local', 'sales'),
      ('00000000-0000-4000-8000-00000000a003', 'Gestor Stock Demonstração', 'stock@demo.local', 'stock_manager') on conflict do nothing`;
    await sql`update app.profiles set receives_leads = false where role = 'stock_manager'`;
    const n = await seedDemoMedia(sql, path.join(root, process.env.LOCAL_STORAGE_DIR ?? ".data/storage"));
    console.log(`✓ ${n} fotografias de demonstração geradas`);
  }
  await sql.end();
  console.log(`Base local pronta: ${dbName}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
