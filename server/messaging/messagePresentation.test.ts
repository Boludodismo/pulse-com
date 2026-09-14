import { describe, expect, it } from "vitest";
import { firstName, removeLegacyNumericReplyInstruction, useFirstNameInGreeting } from "./messagePresentation";

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
