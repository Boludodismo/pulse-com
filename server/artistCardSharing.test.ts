import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  artistCardShareMessage,
  artistCardWhatsAppShareUrl,
} from "../shared/artistCardSharing";
import ArtistProfileSharing from "../client/src/components/artist-card/ArtistProfileSharing";
import ArtistEditorialCard from "../client/src/components/artist-card/ArtistEditorialCard";

describe("public artist card referral", () => {
  const profileUrl = `https://crm.tatuei.com/artista/${"a".repeat(48)}`;
  it("opens visitor WhatsApp with artist name and the exact permanent public URL, without a fixed recipient", () => {
    const url = new URL(
      artistCardWhatsAppShareUrl("Ana Júlia & Arte", profileUrl)
    );
    expect(url.hostname).toBe("wa.me");
    expect(url.pathname).toBe("/");
    expect(url.searchParams.get("text")).toBe(
      artistCardShareMessage("Ana Júlia & Arte", profileUrl)
    );
    expect(url.searchParams.get("text")).toContain(profileUrl);
  });
  it("offers WhatsApp, copying and a QR placeholder for the same public profile", () => {
    const html = renderToStaticMarkup(
      createElement(ArtistProfileSharing, { name: "Ana Júlia", profileUrl })
    );
    expect(html).toContain("Compartilhar no WhatsApp");
    expect(html).toContain("Copiar link");
    expect(html).toContain("Preparando QR Code");
    expect(html).toContain(profileUrl);
    expect(html).toContain("amigos e conhecidos");
  });
  it("adds authorized referral at the end of the public card after saving contact", () => {
    const props = {
      name: "Artista",
      headline: "",
      description: "",
      links: [],
      images: [],
      presentation: { version: 1 as const, sharingEnabled: true },
    };
    expect(
      renderToStaticMarkup(
        createElement(ArtistEditorialCard, { ...props, profileUrl })
      )
    ).toContain("Compartilhe este artista");
    const html = renderToStaticMarkup(
      createElement(ArtistEditorialCard, { ...props, profileUrl })
    );
    expect(html.indexOf("Compartilhe este artista")).toBeGreaterThan(
      html.indexOf("Salvar contato no celular")
    );
    expect(html.indexOf("Compartilhe este artista")).toBeLessThan(
      html.indexOf("<footer")
    );
  });
  it.each([undefined, false])(
    "hides referral without explicit artist permission (%s) while keeping contact saving",
    sharingEnabled => {
      const props = {
        name: "Artista",
        headline: "",
        description: "",
        links: [],
        images: [],
        profileUrl,
        presentation: { version: 1 as const, sharingEnabled },
      };
      const html = renderToStaticMarkup(
        createElement(ArtistEditorialCard, props)
      );
      expect(html).not.toContain("Compartilhe este artista");
      expect(html).not.toContain("Compartilhar no WhatsApp");
      expect(html).not.toContain("Preparando QR Code");
      expect(html).toContain("Salvar contato no celular");
    }
  );
});
