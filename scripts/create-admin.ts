/**
 * Cria o PRIMEIRO administrador de forma segura (sem palavra-passe fixa e sem inscrição pública).
 *
 *   SUPABASE_URL=... SUPABASE_SECRET_KEY=... DATABASE_URL=... SITE_URL=https://... \
 *   npm run admin:create -- --email nome@empresa.pt --name "Nome Apelido"
 *
 * A Supabase envia um convite por email; a pessoa define a palavra-passe e, ao entrar,
 * é obrigada a configurar a verificação em dois passos (MFA). As variáveis são lidas do
 * ambiente do terminal — nunca as escrevas em ficheiros do repositório.
 */
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email")?.toLowerCase();
  const name = arg("name");
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const db = process.env.DATABASE_URL;
  const site = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (!email || !name || !url || !key || !db || !site) {
    console.error("Uso: npm run admin:create -- --email EMAIL --name \"NOME\" (com SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL e SITE_URL definidos)");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo: `${site.replace(/\/$/, "")}/admin/auth/callback?next=/admin/nova-palavra-passe` });
  if (error || !data.user) throw new Error(`Convite falhou: ${error?.message}`);
  const sql = postgres(db, { prepare: false });
  await sql`insert into app.profiles (id, full_name, email, role) values (${data.user.id}, ${name}, ${email}, 'admin')
            on conflict (id) do update set role = 'admin', is_active = true, full_name = excluded.full_name`;
  await sql`insert into app.audit_logs (action, entity, entity_id, data) values ('bootstrap_admin', 'profiles', ${data.user.id}, ${sql.json({ email })})`;
  await sql.end();
  console.log(`Convite enviado para ${email}. Perfil de administrador criado.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
