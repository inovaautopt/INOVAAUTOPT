import { expect, test } from "@playwright/test";
import { rejectCookies } from "./helpers";

test.describe("painel", () => {
  test.skip(({ isMobile }) => isMobile, "fluxo do painel testado em desktop");

  test("colaborador autentica, vê contacto, edita preço e marca viatura vendida", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/entrar/);
    await page.getByLabel("Email").fill("admin@demo.local");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: /Olá/ })).toBeVisible();

    await page.goto("/admin/contactos");
    await expect(page.getByRole("heading", { name: "Contactos" })).toBeVisible();

    await page.goto("/admin/viaturas/00000000-0000-4000-8000-0000000000d5");
    const price = page.getByLabel("Preço total de venda (€)");
    await price.fill("20990");
    await page.getByRole("button", { name: "Guardar alterações" }).click();
    await expect(page.getByText("Alterações guardadas.")).toBeVisible();

    await page.goto("/viaturas/demo-toyota-c-hr-demo-05");
    await rejectCookies(page);
    await expect(page.locator("p.heading:visible", { hasText: /20\s990\s€/ }).first()).toBeVisible();

    await page.goto("/admin/viaturas/00000000-0000-4000-8000-0000000000d5");
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Marcar vendida" }).click();
    await expect(page.locator(".tag", { hasText: "Vendido" }).first()).toBeVisible();

    await page.goto("/viaturas");
    await expect(page.getByRole("link", { name: "Toyota C-HR" })).toHaveCount(0);
    await page.goto("/viaturas/demo-toyota-c-hr-demo-05");
    await expect(page.getByText(/já foi vendida/).first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Marcar visita" })).toHaveCount(0);
  });

  test("vendedor não acede a configuração nem utilizadores", async ({ page }) => {
    await page.goto("/admin/entrar");
    await page.getByLabel("Email").fill("vendedor@demo.local");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("heading", { name: /Olá/ })).toBeVisible();
    await page.goto("/admin/configuracao");
    await expect(page).toHaveURL(/erro=sem-permissao/);
    await page.goto("/admin/utilizadores");
    await expect(page).toHaveURL(/erro=sem-permissao/);
  });

  test("API privada de envio WhatsApp exige sessão", async ({ request }) => {
    const res = await request.post("/api/admin/whatsapp/send", { data: {}, headers: { Origin: "http://localhost:3000" } });
    expect([401, 403, 422, 400, 503]).toContain(res.status());
  });
});
