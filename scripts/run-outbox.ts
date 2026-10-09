/**
 * Chama o processamento agendado manualmente (útil em staging ou para recuperar a fila).
 *   SITE_URL=https://... CRON_SECRET=... npm run outbox:run
 */
async function main() {
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  const res = await fetch(`${site.replace(/\/$/, "")}/api/cron/outbox`, { method: "POST", headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  console.log(res.status, await res.text());
  if (!res.ok) process.exit(1);
}
main();
