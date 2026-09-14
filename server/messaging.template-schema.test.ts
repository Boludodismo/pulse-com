import { describe, expect, it } from "vitest";
import { messageTemplates } from "../drizzle/schema";

describe("schema de templates de mensagem", () => {
  it("mapeia o escopo de estúdio para a coluna física usada na produção", () => {
    expect(messageTemplates.studioId.name).toBe("studio_id");
  });
});
