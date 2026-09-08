import { describe, expect, it } from "vitest";
import { getAffectedRows, getOutboundEventIdempotencyKey } from "./messaging/service";

describe("reserva de jobs de integração", () => {
  it("reconhece o cabeçalho retornado pelo driver MySQL em uma tupla", () => {
    expect(getAffectedRows([{ affectedRows: 1 }, []])).toBe(1);
  });

  it("não processa um job quando nenhuma linha foi reservada", () => {
    expect(getAffectedRows([{ affectedRows: 0 }, []])).toBe(0);
  });

  it("mantém compatibilidade com retorno direto do cabeçalho", () => {
    expect(getAffectedRows({ affectedRows: 1 })).toBe(1);
  });

  it("deriva uma chave estável e exclusiva para auditar o evento outbound", () => {
    expect(getOutboundEventIdempotencyKey("job-a")).toBe(getOutboundEventIdempotencyKey("job-a"));
    expect(getOutboundEventIdempotencyKey("job-a")).not.toBe(getOutboundEventIdempotencyKey("job-b"));
  });
});
