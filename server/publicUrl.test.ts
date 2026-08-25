import { describe, expect, it } from "vitest";
import { normalizePublicBaseUrl } from "@shared/const";

describe("normalizePublicBaseUrl", () => {
  it("remove espaços e quebras invisíveis antes de montar o link", () => {
    const baseUrl = normalizePublicBaseUrl("  https://crm.tatuei.com\n ");

    expect(`${baseUrl}/anamnese/token123`).toBe(
      "https://crm.tatuei.com/anamnese/token123",
    );
  });

  it("remove barras finais para não duplicar o separador", () => {
    expect(normalizePublicBaseUrl("https://crm.tatuei.com///")).toBe(
      "https://crm.tatuei.com",
    );
  });
});
