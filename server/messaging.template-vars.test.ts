import { describe, expect, it } from "vitest";
import { interpolateTemplate } from "./messaging/provider";

describe("templates de mensagem", () => {
  it("interpela as variáveis usadas nos lembretes e nas orientações de cuidados", () => {
    const template = "Olá, {nome_cliente}. {servico} com {nome_artista} em {data}, às {hora}. Anamnese: {link_anamnese}. Guia: {link_ebook}";
    const result = interpolateTemplate(template, {
      nome_cliente: "Ana",
      servico: "Tatuagem",
      nome_artista: "Rafa",
      data: "02/09/2026",
      hora: "14:00",
      link_anamnese: "https://tatuei.com/anamnese/abc",
      link_ebook: "https://tatuei.com/cuidados",
    });

    expect(result).toBe("Olá, Ana. Tatuagem com Rafa em 02/09/2026, às 14:00. Anamnese: https://tatuei.com/anamnese/abc. Guia: https://tatuei.com/cuidados");
  });

  it("preserva o texto quando a variável não é fornecida", () => {
    expect(interpolateTemplate("Olá, {nome_cliente}!", {})).toBe("Olá, {nome_cliente}!");
  });
});
