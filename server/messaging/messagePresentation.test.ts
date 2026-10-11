import { describe, expect, it } from "vitest";
import { firstName, useClientFirstName, removeLegacyNumericReplyInstruction, useFirstNameInGreeting } from "./messagePresentation";

describe("apresentação de mensagens de agendamento", () => {
  it("usa apenas o primeiro nome na saudação", () => {
    expect(firstName("Gilson Carvalho")).toBe("Gilson");
    expect(useFirstNameInGreeting("Olá, Gilson Carvalho! Seu horário está confirmado.", "Gilson Carvalho"))
      .toBe("Olá, Gilson! Seu horário está confirmado.");
  });

  it("remove instruções legadas de resposta numérica", () => {
    const cleaned = removeLegacyNumericReplyInstruction("Olá, Gilson!\n\nResponda *1* para confirmar presença.");
    expect(cleaned).toBe("Olá, Gilson!");
    expect(cleaned).not.toContain("1");
  });
});

describe("primeiro nome nas mensagens ao cliente", () => {
  it("corrige texto persistido, saudações variadas e marcadores", () => {
    expect(useClientFirstName("Bom dia, Maria Fernanda Souza! Obrigado, Maria Fernanda Souza. {nome_cliente}", "Maria Fernanda Souza"))
      .toBe("Bom dia, Maria! Obrigado, Maria. Maria");
  });
  it("preserva nomes de terceiros, links e nomes que apenas começam igual", () => {
    expect(useClientFirstName("Olá, Ana Silva! Artista: Ana Silvares. https://exemplo.com/Ana Silva", "Ana Silva"))
      .toBe("Olá, Ana! Artista: Ana Silvares. https://exemplo.com/Ana Silva");
  });
  it("trata espaços, acentos e caracteres especiais como texto literal", () => {
    expect(useClientFirstName("Oi, João   D'Ávila! Maria Souza atende.", " João D'Ávila "))
      .toBe("Oi, João! Maria Souza atende.");
    expect(useClientFirstName("Oi, Ana$& Souza!", "Ana$& Souza")).toBe("Oi, Ana$&!");
  });
  it("não inventa um nome quando não há cadastro disponível", () => {
    expect(useClientFirstName("Bom dia! Sua sessão está confirmada.", null)).toBe("Bom dia! Sua sessão está confirmada.");
  });
});
