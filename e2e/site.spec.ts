import { expect, test } from "@playwright/test";
import { humanPause, nextWeekday, rejectCookies } from "./helpers";

test.describe("site público", () => {
  test("pesquisar, filtrar, partilhar filtros no URL e voltar atrás", async ({ page, isMobile }) => {
    await page.goto("/");
    await rejectCookies(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByLabel("Marca").first().selectOption("Peugeot");
    await page.getByRole("button", { name: /Ver viaturas/ }).click();
    await expect(page).toHaveURL(/marca=Peugeot/);
    await expect(page.getByText(/1 viatura encontrada/)).toBeVisible();

    await page.goto("/viaturas?combustivel=diesel&ordem=price_asc");
    await expect(page.getByRole("list", { name: "Filtros ativos" })).toContainText("Gasóleo");
    await page.getByRole("link", { name: /Gasóleo/ }).click();
    await expect(page).not.toHaveURL(/combustivel/);
    await page.goBack();
    await expect(page).toHaveURL(/combustivel=diesel/);

    // intervalos inválidos não são corrigidos em silêncio
    await page.goto("/viaturas?precoMin=30000&precoMax=1000");
    await expect(page.getByRole("alert").filter({ hasText: "preço mínimo" })).toBeVisible();

    if (isMobile) {
      await page.goto("/viaturas");
      await page.getByRole("button", { name: /Filtros/ }).click();
      await expect(page.getByRole("dialog", { name: "Filtros" })).toBeVisible();
      await page.getByRole("dialog").getByText("Elétrico").click();
      await expect(page).toHaveURL(/combustivel=electric/);
      await page.getByRole("button", { name: /Mostrar 1 viatura/ }).click();
    }
  });

  test("ficha da viatura, favoritos e comparador sem registo", async ({ page }) => {
    await page.goto("/viaturas/demo-peugeot-3008-demo-01");
    await rejectCookies(page);
    await expect(page.getByRole("heading", { level: 1, name: /Peugeot 3008/ })).toBeVisible();
    await expect(page.locator("p.line-through:visible").first()).toBeVisible(); // redução real do histórico de preços
    await page.getByRole("button", { name: /Guardar Peugeot 3008 nos favoritos/ }).first().click();
    await page.getByRole("button", { name: /Adicionar Peugeot 3008 ao comparador/ }).click();
    await page.goto("/viaturas/demo-renault-clio-demo-02");
    await page.getByRole("button", { name: /Adicionar Renault Clio ao comparador/ }).click();

    await page.goto("/favoritos");
    await expect(page.getByRole("link", { name: "Peugeot 3008", exact: true }).first()).toBeVisible();
    await page.goto("/comparar");
    await expect(page.getByRole("table")).toContainText("Renault Clio");
    await page.getByLabel("Mostrar só as diferenças").check();
    await expect(page.getByRole("rowheader", { name: /Combustível/ })).toBeVisible();
  });

  test("galeria por teclado e WhatsApp com referência e URL", async ({ page }) => {
    await page.goto("/viaturas/demo-tesla-model-3-demo-03");
    await rejectCookies(page);
    const gallery = page.getByRole("region", { name: /Fotografias de Tesla Model 3/ });
    await gallery.getByRole("button", { name: "Fotografia seguinte" }).click();
    await expect(gallery.getByText("2 / 3").first()).toBeVisible();
    const wa = page.getByRole("link", { name: /WhatsApp/ }).first();
    const href = await wa.getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    expect(decodeURIComponent(href!.split("text=")[1]!)).toContain("referência DEMO-03");
    await expect(page.getByText(/Fonte:.*demonstração/)).toBeVisible(); // dados de bateria com fonte
  });

  test("enviar pedido de informação", async ({ page }) => {
    await page.goto("/viaturas/demo-toyota-c-hr-demo-05");
    await rejectCookies(page);
    const form = page.locator("#contactar");
    await form.getByLabel("Nome", { exact: true }).fill("Teste E2E");
    await form.getByLabel("Telefone", { exact: true }).fill("912 345 678");
    await humanPause(page);
    await form.getByRole("button", { name: "Enviar pedido" }).click();
    await expect(form.getByRole("status")).toContainText("Pedido recebido");
  });

  test("erros de validação ficam junto dos campos", async ({ page }) => {
    await page.goto("/contactos");
    await rejectCookies(page);
    const form = page.locator("form").filter({ hasText: "Mensagem" }).first();
    await form.getByLabel("Nome", { exact: true }).fill("X Y");
    await humanPause(page);
    await form.getByRole("button", { name: "Enviar pedido" }).click();
    await expect(form.getByText("Indica pelo menos um contacto")).toBeVisible();
  });

  test("pedir retoma com fotografia", async ({ page }) => {
    await page.goto("/retomas");
    await rejectCookies(page);
    await page.getByLabel("Marca").fill("Opel");
    await page.getByLabel("Modelo").fill("Corsa");
    await page.getByLabel("Ano").selectOption("2016");
    await page.getByLabel("Quilómetros").fill("120000");
    await page.getByLabel("Combustível").selectOption({ label: "Gasóleo" });
    // JPEG mínimo válido (1x1)
    const jpeg = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=", "base64");
    await page.getByLabel(/Fotografias/).setInputFiles({ name: "carro.jpg", mimeType: "image/jpeg", buffer: jpeg });
    await page.getByLabel("Nome", { exact: true }).fill("Retoma E2E");
    await page.getByLabel("Email", { exact: true }).fill("retoma@example.com");
    await humanPause(page);
    await page.getByRole("button", { name: "Pedir avaliação" }).click();
    await expect(page.getByRole("status")).toContainText("Pedido de avaliação recebido");
  });

  test("marcar visita é um pedido sujeito a confirmação", async ({ page }) => {
    await page.goto("/viaturas/demo-renault-clio-demo-02");
    await rejectCookies(page);
    const panel = page.locator("#contactar");
    await panel.getByRole("tab", { name: "Marcar visita" }).click();
    await panel.getByLabel("Dia pretendido").fill(nextWeekday(2));
    await panel.getByLabel("Nome", { exact: true }).fill("Visita E2E");
    await panel.getByLabel("Email", { exact: true }).fill("visita@example.com");
    await humanPause(page);
    await panel.getByRole("button", { name: "Pedir marcação" }).click();
    await expect(panel.getByRole("status")).toContainText("Ainda não é uma marcação confirmada");
  });

  test("viatura inexistente devolve 404 útil", async ({ page }) => {
    const res = await page.goto("/viaturas/nao-existe-123");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Ver viaturas disponíveis" })).toBeVisible();
  });

  test("rejeitar cookies mantém scripts de terceiros bloqueados", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (!["localhost", "127.0.0.1"].includes(u.hostname) && !u.protocol.startsWith("data")) external.push(u.hostname);
    });
    await page.goto("/contactos");
    await page.getByRole("button", { name: "Rejeitar não essenciais" }).click();
    await page.reload();
    await expect(page.getByRole("button", { name: "Rejeitar não essenciais" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Mostrar mapa" })).toBeVisible(); // mapa não carregado
    expect(external.filter((h) => /google|facebook|youtube/.test(h))).toEqual([]);
  });
});
