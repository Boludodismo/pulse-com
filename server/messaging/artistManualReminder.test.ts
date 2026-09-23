import { describe, expect, it } from "vitest";
import {
  buildArtistManualReminderMessage,
  buildClientWhatsAppLink,
  buildManualClientReminderMessage,
} from "./automaticReminders";

describe("artist manual WhatsApp reminder", () => {
  const actionLinks = {
    confirmed: "https://tatuei.com/confirmar?token=confirm&action=confirmed",
    early: "https://tatuei.com/confirmar?token=early&action=early",
    late: "https://tatuei.com/confirmar?token=late&action=late",
    reschedule_requested: "https://tatuei.com/confirmar?token=reschedule&action=reschedule_requested",
  };

  it("prepares the client message using the existing Tatuei action links", () => {
    const message = buildManualClientReminderMessage({
      clientName: "João da Silva",
      studioName: "Tatuei Studio",
      artistName: "Carlos",
      service: "Realismo",
      date: "23/09/2026",
      time: "14:00",
      actionLinks,
    });

    expect(message).toContain("Olá, João!");
    expect(message).toContain(actionLinks.confirmed);
    expect(message).toContain(actionLinks.early);
    expect(message).toContain(actionLinks.late);
    expect(message).toContain(actionLinks.reschedule_requested);
    expect(message).toContain("registrada diretamente no Tatuei");
  });

  it("creates a WhatsApp click-to-chat URL without changing the client action links", () => {
    const clientMessage = buildManualClientReminderMessage({
      clientName: "João",
      studioName: "Tatuei Studio",
      artistName: "Carlos",
      service: "Realismo",
      date: "23/09/2026",
      time: "14:00",
      actionLinks,
    });
    const link = buildClientWhatsAppLink("(38) 99999-9999", clientMessage);

    expect(link).toMatch(/^https:\/\/wa\.me\/5538999999999\?text=/);
    expect(decodeURIComponent(link)).toContain(actionLinks.confirmed);
    expect(decodeURIComponent(link)).toContain(actionLinks.reschedule_requested);
  });

  it("prepares the studio-to-artist notification with the click-to-chat link", () => {
    const link = "https://wa.me/5538999999999?text=mensagem";
    const message = buildArtistManualReminderMessage({
      artistName: "Carlos Pereira",
      clientName: "João",
      service: "Realismo",
      date: "23/09/2026",
      time: "14:00",
      clientWhatsAppLink: link,
    });

    expect(message).toContain("Olá, Carlos!");
    expect(message).toContain("João");
    expect(message).toContain(link);
    expect(message).toContain("resposta volta para o Tatuei");
  });
});
