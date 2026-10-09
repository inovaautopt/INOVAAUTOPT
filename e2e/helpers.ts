import type { Page } from "@playwright/test";

/** Rejeita cookies não essenciais (o banner não deve bloquear o resto). */
export async function rejectCookies(page: Page) {
  const btn = page.getByRole("button", { name: "Rejeitar não essenciais" }).first();
  if (await btn.isVisible().catch(() => false)) await btn.click();
}

/** Espera > 2 s desde a abertura do formulário (proteção antiabuso contra envios instantâneos). */
export async function humanPause(page: Page) {
  await page.waitForTimeout(2200);
}

export function nextWeekday(dayIndex: number) {
  // dayIndex: 1 = segunda-feira
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== dayIndex) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
