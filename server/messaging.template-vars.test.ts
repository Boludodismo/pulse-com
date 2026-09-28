import { describe, expect, it } from "vitest";
import { interpolateTemplate } from "./messaging/provider";

describe("templates de mensagem", () => {
  it("interpela as variáveis usadas nos lembretes e nas orientações de cuidados", () => {
    const template =
      "Olá, {nome_cliente}. {servico} com {nome_artista} em {data}, às {hora}. Anamnese: {link_anamnese}. Guia: {link_ebook}";
    const result = interpolateTemplate(template, {
      nome_cliente: "Ana",
      servico: "Tatuagem",
      nome_artista: "Rafa",
      data: "02/09/2026",
      hora: "14:00",
      link_anamnese: "https://tatuei.com/anamnese/abc",
      link_ebook: "https://tatuei.com/cuidados",
    });

    expect(result).toBe(
      "Olá, Ana. Tatuagem com Rafa em 02/09/2026, às 14:00. Anamnese: https://tatuei.com/anamnese/abc. Guia: https://tatuei.com/cuidados"
    );
  });

  it("preserva o texto quando a variável não é fornecida", () => {
    expect(interpolateTemplate("Olá, {nome_cliente}!", {})).toBe(
      "Olá, {nome_cliente}!"
    );
  });
});

import { CARE_DEFAULTS, renderCareMessage } from "../shared/customerCare";
import {
  personalizeClientPlaceholders,
  hasClientNamePlaceholder,
} from "../shared/messageTemplate";
describe("nome real em mensagens automáticas", () => {
  it("substitui primeiro_nome usando o nome recebido, incluindo repetição, espaços e chaves duplas", () => {
    expect(
      interpolateTemplate(
        "Oi, {primeiro_nome}! {{ primeiro_nome }} / { PRIMEIRO_NOME }",
        { nome_cliente: "  Ana Júlia Souza  " }
      )
    ).toBe("Oi, Ana! Ana / Ana");
  });
  it.each(CARE_DEFAULTS.map(c => [c.name, c.body]))(
    "personaliza o modelo %s",
    (_, body) => {
      const result = renderCareMessage(body, {
        nome_cliente: "João da Silva",
        nome_estudio: "Tatuei",
        nome_artista: "Will",
        link_feedback: "https://example.test/feedback",
      });
      expect(result).toContain("João");
      expect(result).not.toContain("{");
      expect(result).not.toContain("da Silva");
    }
  );
  it("personaliza mensagens já na fila sem inventar nome ou depender de telefone", () => {
    expect(
      personalizeClientPlaceholders(
        "Bom dia, {primeiro_nome}!",
        "  Érica Ferreira"
      )
    ).toBe("Bom dia, Érica!");
    expect(
      personalizeClientPlaceholders("Olá, {{nome_cliente}}!", "Willian Cunha")
    ).toBe("Olá, Willian!");
    expect(() =>
      personalizeClientPlaceholders("Olá, {primeiro_nome}!", null)
    ).toThrow("nome válido");
    expect(() =>
      personalizeClientPlaceholders("Olá, {primeiro_nome}!", "{primeiro_nome}")
    ).toThrow();
    expect(hasClientNamePlaceholder("Olá, Érica!")).toBe(false);
  });
  it("mantém mensagens prontas e não interpreta símbolos do nome como substituições", () => {
    expect(
      personalizeClientPlaceholders("Mensagem pronta", "Outro cliente")
    ).toBe("Mensagem pronta");
    expect(
      interpolateTemplate("Oi, {primeiro_nome}", {
        nome_cliente: "Ana$& Souza",
      })
    ).toBe("Oi, Ana$&");
  });
});
