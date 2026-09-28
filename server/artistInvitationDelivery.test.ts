import { describe, expect, it } from "vitest";
import { artistInvitationMessage, artistInvitationUrl } from "./artistInvitationDelivery";

describe("entrega do convite de artista", () => {
  it("monta o link no domínio configurado sem barra duplicada", () => {
    expect(artistInvitationUrl("abc123", "https://crm.tatuei.com/"))
      .toBe("https://crm.tatuei.com/convite-artista/abc123");
  });

  it("personaliza a mensagem sem expor mais dados que o necessário", () => {
    const inviteUrl = "https://crm.tatuei.com/convite-artista/token";
    const message = artistInvitationMessage({
      artistName: "Ana Júlia Mello",
      studioName: "Willian Cunha Tattoo",
      inviteUrl,
    });

    expect(message).toContain("Olá, Ana!");
    expect(message).toContain("Willian Cunha Tattoo");
    expect(message).toContain(inviteUrl);
    expect(message).toContain("válido por 7 dias");
  });
});
