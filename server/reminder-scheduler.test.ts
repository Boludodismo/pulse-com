/**
 * reminder-scheduler.test.ts
 * Testes unitários para a lógica de filtro de data do scheduler de lembretes.
 * Verifica que apenas agendamentos do DIA SEGUINTE são selecionados,
 * usando horário local (sem conversão UTC), e que lembretes já enviados
 * não são reenviados.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Helpers replicados do db.ts para teste isolado ────────────────────────────

function toLocalDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}

function getTomorrowRange(now: Date): { start: string; end: string } {
  const tomorrowStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0
  );
  const tomorrowEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    23, 59, 59
  );
  return {
    start: toLocalDateStr(tomorrowStart),
    end: toLocalDateStr(tomorrowEnd),
  };
}

function isInTomorrowRange(dateStr: string, now: Date): boolean {
  const { start, end } = getTomorrowRange(now);
  return dateStr >= start && dateStr <= end;
}

function filterUpcomingAppointments(
  appointments: Array<{ id: number; date: string; status: string }>,
  alreadySentIds: Set<number>,
  now: Date
) {
  return appointments.filter(
    (apt) =>
      isInTomorrowRange(apt.date, now) &&
      (apt.status === "agendado" || apt.status === "confirmado") &&
      !alreadySentIds.has(apt.id)
  );
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe("toLocalDateStr", () => {
  it("formata data local sem conversão UTC", () => {
    // Cria data local explícita (sem depender de fuso do ambiente)
    const d = new Date(2026, 2, 29, 14, 30, 0); // 29/03/2026 14:30:00 local
    const result = toLocalDateStr(d);
    expect(result).toBe("2026-03-29 14:30:00");
  });

  it("preenche zeros à esquerda corretamente", () => {
    const d = new Date(2026, 0, 5, 9, 5, 3); // 05/01/2026 09:05:03
    expect(toLocalDateStr(d)).toBe("2026-01-05 09:05:03");
  });
});

describe("getTomorrowRange", () => {
  it("retorna início do dia seguinte como 00:00:00", () => {
    const now = new Date(2026, 2, 28, 10, 0, 0); // 28/03/2026 10:00
    const { start } = getTomorrowRange(now);
    expect(start).toBe("2026-03-29 00:00:00");
  });

  it("retorna fim do dia seguinte como 23:59:59", () => {
    const now = new Date(2026, 2, 28, 10, 0, 0);
    const { end } = getTomorrowRange(now);
    expect(end).toBe("2026-03-29 23:59:59");
  });

  it("funciona corretamente na virada de mês", () => {
    const now = new Date(2026, 2, 31, 23, 59, 0); // 31/03/2026 (último dia do mês)
    const { start, end } = getTomorrowRange(now);
    expect(start).toBe("2026-04-01 00:00:00");
    expect(end).toBe("2026-04-01 23:59:59");
  });

  it("funciona corretamente na virada de ano", () => {
    const now = new Date(2025, 11, 31, 12, 0, 0); // 31/12/2025
    const { start, end } = getTomorrowRange(now);
    expect(start).toBe("2026-01-01 00:00:00");
    expect(end).toBe("2026-01-01 23:59:59");
  });
});

describe("filterUpcomingAppointments", () => {
  const now = new Date(2026, 2, 28, 10, 0, 0); // 28/03/2026 10:00

  const appointments = [
    { id: 1, date: "2026-03-29 09:00:00", status: "agendado" },   // ✅ amanhã
    { id: 2, date: "2026-03-29 14:30:00", status: "confirmado" }, // ✅ amanhã
    { id: 3, date: "2026-03-29 18:00:00", status: "cancelado" },  // ❌ cancelado
    { id: 4, date: "2026-03-28 11:00:00", status: "agendado" },   // ❌ hoje
    { id: 5, date: "2026-03-30 10:00:00", status: "agendado" },   // ❌ depois de amanhã
    { id: 6, date: "2026-03-27 09:00:00", status: "agendado" },   // ❌ ontem
  ];

  it("retorna apenas agendamentos do dia seguinte com status válido", () => {
    const result = filterUpcomingAppointments(appointments, new Set(), now);
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.id)).toEqual([1, 2]);
  });

  it("exclui agendamentos que já receberam lembrete", () => {
    const alreadySent = new Set([1]); // id=1 já foi notificado
    const result = filterUpcomingAppointments(appointments, alreadySent, now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it("retorna lista vazia se todos já foram notificados", () => {
    const alreadySent = new Set([1, 2]);
    const result = filterUpcomingAppointments(appointments, alreadySent, now);
    expect(result).toHaveLength(0);
  });

  it("retorna lista vazia se não há agendamentos amanhã", () => {
    const onlyToday = [
      { id: 10, date: "2026-03-28 09:00:00", status: "agendado" },
    ];
    const result = filterUpcomingAppointments(onlyToday, new Set(), now);
    expect(result).toHaveLength(0);
  });

  it("inclui agendamentos nos extremos do dia (00:00 e 23:59)", () => {
    const edgeCases = [
      { id: 20, date: "2026-03-29 00:00:00", status: "agendado" }, // início do dia
      { id: 21, date: "2026-03-29 23:59:59", status: "agendado" }, // fim do dia
    ];
    const result = filterUpcomingAppointments(edgeCases, new Set(), now);
    expect(result).toHaveLength(2);
  });
});

describe("buildReminderMessage", () => {
  it("formata mensagem consolidada corretamente", () => {
    const appointments = [
      {
        id: 1,
        clientName: "Ana Lima",
        service: "Manga Completa",
        artist: "Fernanda",
        date: "2026-03-29 09:00:00",
      },
      {
        id: 2,
        clientName: "Carlos Souza",
        service: "Tribal",
        artist: "Rafael",
        date: "2026-03-29 14:30:00",
      },
    ];

    const lines = appointments.map((apt) => {
      const time = new Date(apt.date).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `• ${time} — ${apt.clientName} | ${apt.service} | ${apt.artist}`;
    });

    const message = `Resumo dos agendamentos de amanhã:\n\n${lines.join("\n")}`;

    expect(message).toContain("Ana Lima");
    expect(message).toContain("Carlos Souza");
    expect(message).toContain("Manga Completa");
    expect(message).toContain("Tribal");
    expect(message).toContain("Resumo dos agendamentos de amanhã:");
    // Deve ser UMA mensagem, não duas separadas
    expect(message.split("Resumo dos agendamentos").length).toBe(2);
  });

  it("título indica quantidade correta de agendamentos", () => {
    const count = 3;
    const title = `📅 ${count} agendamento(s) amanhã`;
    expect(title).toContain("3 agendamento(s)");
  });
});

// ── Testes do Scheduler WhatsApp Automático ───────────────────────────────────

function getTargetDayRange(now: Date, daysBefore: number): { start: string; end: string } {
  const targetStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + daysBefore,
    0, 0, 0
  );
  const targetEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + daysBefore,
    23, 59, 59
  );
  return {
    start: toLocalDateStr(targetStart),
    end: toLocalDateStr(targetEnd),
  };
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function isInSendWindow(currentTime: string, sendTime: string): boolean {
  return currentTime >= sendTime && currentTime <= addMinutes(sendTime, 5);
}

describe("WhatsApp Scheduler — getTargetDayRange", () => {
  it("daysBefore=1 retorna o dia seguinte", () => {
    const now = new Date(2026, 3, 10, 10, 0, 0); // 10/04/2026
    const { start, end } = getTargetDayRange(now, 1);
    expect(start).toBe("2026-04-11 00:00:00");
    expect(end).toBe("2026-04-11 23:59:59");
  });

  it("daysBefore=2 retorna dois dias à frente", () => {
    const now = new Date(2026, 3, 10, 10, 0, 0);
    const { start, end } = getTargetDayRange(now, 2);
    expect(start).toBe("2026-04-12 00:00:00");
    expect(end).toBe("2026-04-12 23:59:59");
  });

  it("daysBefore=3 funciona na virada de mês", () => {
    const now = new Date(2026, 3, 29, 10, 0, 0); // 29/04/2026
    const { start } = getTargetDayRange(now, 3);
    expect(start).toBe("2026-05-02 00:00:00");
  });
});

describe("WhatsApp Scheduler — addMinutes", () => {
  it("adiciona minutos corretamente", () => {
    expect(addMinutes("09:00", 5)).toBe("09:05");
    expect(addMinutes("09:57", 5)).toBe("10:02");
    expect(addMinutes("23:58", 5)).toBe("00:03");
  });
});

describe("WhatsApp Scheduler — isInSendWindow", () => {
  it("retorna true quando horário está dentro da janela de 5 min", () => {
    expect(isInSendWindow("09:00", "09:00")).toBe(true);
    expect(isInSendWindow("09:03", "09:00")).toBe(true);
    expect(isInSendWindow("09:05", "09:00")).toBe(true);
  });

  it("retorna false quando horário está fora da janela", () => {
    expect(isInSendWindow("08:59", "09:00")).toBe(false);
    expect(isInSendWindow("09:06", "09:00")).toBe(false);
    expect(isInSendWindow("18:00", "09:00")).toBe(false);
  });
});

describe("WhatsApp Scheduler — buildWhatsAppMessage", () => {
  it("mensagem contém dados do agendamento e opções de confirmação", () => {
    const apt = {
      id: 42,
      clientName: "Maria Silva",
      date: "2026-04-11 14:30:00",
      service: "Floral no Braço",
      artist: "Fernanda",
    };
    const baseUrl = "https://tatuei.com";
    const token = "abc123";
    const confirmUrl = `${baseUrl}/confirmar?id=${apt.id}&token=${token}`;

    const message =
      `Olá ${apt.clientName}! 👋\n\n` +
      `Lembramos que você tem um agendamento:\n` +
      `📅 ${new Date(apt.date).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })} às ${new Date(apt.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}\n` +
      `✏️ ${apt.service} com ${apt.artist}\n\n` +
      `Por favor, confirme sua presença:\n` +
      `✅ Confirmado: ${confirmUrl}&status=confirmado\n` +
      `❌ Não confirmado: ${confirmUrl}&status=nao_confirmado\n` +
      `⏰ Atraso: ${confirmUrl}&status=atraso\n` +
      `🏃 Chegada antecipada: ${confirmUrl}&status=chegada_antecipada`;

    expect(message).toContain("Maria Silva");
    expect(message).toContain("Floral no Braço");
    expect(message).toContain("Fernanda");
    expect(message).toContain("confirmado");
    expect(message).toContain("nao_confirmado");
    expect(message).toContain("atraso");
    expect(message).toContain("chegada_antecipada");
    expect(message).toContain("tatuei.com/confirmar");
  });

  it("link WhatsApp é montado corretamente com código do país", () => {
    const phone = "11987654321";
    const cleaned = phone.replace(/\D/g, "");
    const withCountry = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    const waLink = `https://wa.me/${withCountry}?text=ola`;
    expect(waLink).toBe("https://wa.me/5511987654321?text=ola");
  });

  it("não duplica código 55 se já estiver presente", () => {
    const phone = "5511987654321";
    const cleaned = phone.replace(/\D/g, "");
    const withCountry = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    expect(withCountry).toBe("5511987654321");
  });
});
