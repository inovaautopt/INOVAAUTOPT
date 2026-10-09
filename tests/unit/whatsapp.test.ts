import { beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { waMeUrl, vehicleContactMessage } from "@/lib/whatsapp-link";

beforeAll(() => {
  Object.assign(process.env, { DATABASE_URL: "postgres://x@localhost/x", AUTH_PROVIDER: "dev", DEV_AUTH_SECRET: "x".repeat(40), STORAGE_DRIVER: "local", META_APP_SECRET: "segredo", WHATSAPP_VERIFY_TOKEN: "token-123" });
});

describe("Click to Chat", () => {
  it("usa só algarismos e codifica a mensagem", () => {
    const msg = vehicleContactMessage({ make: "Peugeot", model: "3008", reference: "IA-0001" }, "https://inovaauto.pt/viaturas/x");
    expect(msg).toBe("Olá, tenho interesse na viatura Peugeot 3008, referência IA-0001. Está disponível? https://inovaauto.pt/viaturas/x");
    const url = waMeUrl("+351 929 218 224", msg);
    expect(url.startsWith("https://wa.me/351929218224?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1]!)).toBe(msg);
  });
});

describe("webhook WhatsApp", async () => {
  const wa = await import("@/server/whatsapp");
  it("verificação GET compara o verify token", () => {
    expect(wa.verifySubscription(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "token-123", "hub.challenge": "42" }))).toBe("42");
    expect(wa.verifySubscription(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "errado", "hub.challenge": "42" }))).toBeNull();
    expect(wa.verifySubscription(new URLSearchParams({ "hub.mode": "unsubscribe", "hub.verify_token": "token-123", "hub.challenge": "42" }))).toBeNull();
  });
  it("valida X-Hub-Signature-256 sobre o corpo bruto", () => {
    const raw = Buffer.from('{"object":"whatsapp_business_account","entry":[]}');
    const sig = "sha256=" + createHmac("sha256", "segredo").update(raw).digest("hex");
    expect(wa.verifySignature(raw, sig, "segredo")).toBe(true);
    expect(wa.verifySignature(Buffer.from(raw.toString() + " "), sig, "segredo")).toBe(false); // corpo alterado
    expect(wa.verifySignature(raw, sig, "outro")).toBe(false);
    expect(wa.verifySignature(raw, null, "segredo")).toBe(false);
    expect(wa.verifySignature(raw, "sha256=zz", "segredo")).toBe(false);
  });
  it("divide lotes em eventos com chaves estáveis (deduplicação)", () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                contacts: [{ wa_id: "351912345678", profile: { name: "Ana" } }],
                messages: [{ id: "wamid.A", from: "351912345678", timestamp: "1790000000", type: "text", text: { body: "Olá" } }],
                statuses: [{ id: "wamid.B", status: "delivered", timestamp: "1790000001" }],
              },
            },
          ],
        },
      ],
    };
    const ev = wa.splitEvents(body, "hash");
    expect(ev.map((e) => e.key)).toEqual(["msg:wamid.A", "status:wamid.B:delivered:1790000001"]);
    expect(wa.splitEvents(body, "hash").map((e) => e.key)).toEqual(ev.map((e) => e.key));
  });
  it("janela de atendimento de 24 h", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    expect(wa.insideServiceWindow(new Date("2026-10-07T13:00:00Z"), now)).toBe(true);
    expect(wa.insideServiceWindow(new Date("2026-10-07T11:00:00Z"), now)).toBe(false);
    expect(wa.insideServiceWindow(null, now)).toBe(false);
  });
});
