import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";
import { parseStockCsv, templateCsv } from "@/lib/stock-csv";
import { hostAllowed, isPublicAddress } from "@/server/remote-image";
import { interpolate, renderMarkdown } from "@/lib/content";

describe("CSV", () => {
  it("neutraliza fórmulas", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+351912")).toBe("'+351912");
    expect(csvCell("@SUM")).toBe("'@SUM");
    expect(csvCell("normal")).toBe("normal");
    expect(toCsv(["a"], [["1;2"]])).toContain('"1;2"');
  });
  it("modelo é importável e valida linhas", () => {
    const { rows, headerErrors } = parseStockCsv(templateCsv());
    expect(headerErrors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.action).toBe("create");
    expect(rows[0]!.data?.fuel).toBe("gasoline");
    expect(rows[0]!.features).toContain("Bluetooth");
  });
  it("rejeita valores desconhecidos, publicação incompleta e referências repetidas", () => {
    const csv = "referencia;estado;marca;modelo;combustivel\nIA-0001;disponivel;Fiat;500;banana\nIA-0001;rascunho;Fiat;500;eletrico\n;rascunho;;;\n";
    const { rows } = parseStockCsv(csv);
    expect(rows[0]!.action).toBe("skip");
    expect(rows[0]!.errors.join(" ")).toMatch(/combustivel/);
    expect(rows[1]!.errors.join(" ")).toMatch(/repetida/);
    expect(rows[2]!.action).toBe("skip");
  });
  it("exige marca e modelo no cabeçalho", () => {
    expect(parseStockCsv("preco_eur\n1000\n").headerErrors.join(" ")).toMatch(/marca/);
  });
});

describe("importação de imagens (SSRF)", () => {
  it("só domínios autorizados", () => {
    expect(hostAllowed("scontent.cdninstagram.com")).toBe(true);
    expect(hostAllowed("instagram.fopo1-1.fna.fbcdn.net")).toBe(true);
    expect(hostAllowed("fbcdn.net.evil.com")).toBe(false);
    expect(hostAllowed("evilfbcdn.net")).toBe(false);
  });
  it("bloqueia redes privadas e metadados", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.3.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    expect(isPublicAddress("157.240.1.1")).toBe(true);
  });
});

describe("conteúdo", () => {
  it("marca dados em falta em vez de os inventar", () => {
    const settings = { company: { tradeName: "Inova Auto", legalName: null, nif: null, email: null, phoneE164: null, whatsappE164: null, instagramUrl: null, facebookUrl: null, privacyEmail: null, valueProposition: null, aboutText: null }, services: {}, legal: {}, financing: {} };
    const r = interpolate("Firma {{empresa.nome_legal}} — {{empresa.nome}}", settings as never, []);
    expect(r.missing).toEqual(["empresa.nome_legal"]);
    expect(r.text).toContain("por preencher");
    expect(r.text).toContain("Inova Auto");
  });
  it("sanitiza HTML editorial", () => {
    const html = renderMarkdown("## Título\n\n<script>alert(1)</script> **forte** [x](javascript:alert(1)) [ok](https://example.com)");
    expect(html).not.toContain("<script>");
    expect(html).not.toMatch(/href="javascript/);
    expect(html).toContain("<strong>forte</strong>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain("<h2>Título</h2>");
  });
});
