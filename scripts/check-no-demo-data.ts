/**
 * Verificação antes do lançamento: falha se existirem dados de demonstração ou textos legais
 * por publicar na base indicada por DATABASE_URL.
 *   DATABASE_URL=... npm run check:prod-data
 */
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  const [demo] = await sql`select
    (select count(*) from app.vehicles where is_demo)::int as vehicles,
    (select count(*) from app.branches where is_demo)::int as branches,
    (select count(*) from app.leads where is_demo)::int as leads`;
  const legal = await sql`select slug, status from app.site_pages where kind = 'legal' and status <> 'published'`;
  const [inst] = await sql`select environment from app.instance`;
  await sql.end();
  const problems: string[] = [];
  if (demo!.vehicles || demo!.branches || demo!.leads) problems.push(`Dados de demonstração: ${JSON.stringify(demo)}`);
  if (legal.length) problems.push(`Textos legais por publicar: ${legal.map((l) => l.slug).join(", ")}`);
  if (inst!.environment !== "production") problems.push(`app.instance.environment = ${inst!.environment} (esperado: production)`);
  if (problems.length) {
    console.error("✗ Não pronto para produção:\n- " + problems.join("\n- "));
    process.exit(1);
  }
  console.log("✓ Sem dados de demonstração, textos legais publicados e base marcada como produção.");
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
