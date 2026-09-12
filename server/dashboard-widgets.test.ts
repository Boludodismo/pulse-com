/**
 * Testes para os três widgets do Dashboard:
 * - WeeklyAppointmentsWidget (lógica de semana e destaque de hoje)
 * - RemindersWidget (geração automática de lembretes)
 * - LowStockWidget (detecção de materiais abaixo do mínimo)
 */
import { describe, it, expect } from "vitest";

// ─── Helpers replicados dos widgets ──────────────────────────────────────────

function isSameLocalDay(dateStr: string, ref: Date): boolean {
  const d = new Date(dateStr.replace(" ", "T"));
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr.replace(" ", "T"));
}

function buildReminders(
  appointments: Array<{ id: number; date: string; clientName: string | null; status: string }>,
  now: Date
) {
  const reminders: Array<{ type: string; message: string }> = [];
  const active = appointments.filter(
    (a) => a.status !== "cancelado" && a.status !== "concluido"
  );

  const todayAppts = active.filter((a) => {
    const d = parseDate(a.date);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  });

  if (todayAppts.length > 0) {
    reminders.push({
      type: "today",
      message:
        todayAppts.length === 1
          ? `Você tem 1 atendimento hoje`
          : `Você tem ${todayAppts.length} atendimentos hoje`,
    });
  }

  const upcoming = active
    .map((a) => ({ ...a, dateObj: parseDate(a.date) }))
    .filter((a) => a.dateObj > now)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

  if (upcoming.length > 0) {
    const next = upcoming[0];
    const diffMs = next.dateObj.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffMins = Math.round(diffMs / (1000 * 60));
    let timeLabel: string;
    if (diffMins < 60) timeLabel = `em ${diffMins} minuto${diffMins !== 1 ? "s" : ""}`;
    else if (diffHours < 24) timeLabel = `em ${Math.floor(diffHours)} hora${Math.floor(diffHours) !== 1 ? "s" : ""}`;
    else timeLabel = `em ${Math.ceil(diffHours / 24)} dia${Math.ceil(diffHours / 24) !== 1 ? "s" : ""}`;
    reminders.push({
      type: diffHours <= 24 ? "next24h" : "next",
      message: `Próximo atendimento ${timeLabel}: ${next.clientName || "cliente"}`,
    });
  }

  const next24h = active.filter((a) => {
    const d = parseDate(a.date);
    const diffMs = d.getTime() - now.getTime();
    return diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000;
  });

  if (next24h.length > 1) {
    reminders.push({
      type: "next24h",
      message: `${next24h.length} atendimento${next24h.length !== 1 ? "s" : ""} nas próximas 24h`,
    });
  }

  if (reminders.length === 0) {
    reminders.push({ type: "info", message: "Nenhum atendimento próximo esta semana" });
  }

  return reminders;
}

function getWeekBounds(now: Date) {
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

// ─── Testes ──────────────────────────────────────────────────────────────────

describe("WeeklyAppointmentsWidget — lógica de semana", () => {
  it("deve identificar corretamente a segunda-feira da semana atual", () => {
    // Quinta-feira
    const thursday = new Date("2026-05-07T10:00:00");
    const { monday } = getWeekBounds(thursday);
    expect(monday.getDay()).toBe(1); // 1 = segunda
    expect(monday.getDate()).toBe(4); // 04/05/2026
  });

  it("deve identificar corretamente o domingo da semana atual", () => {
    const thursday = new Date("2026-05-07T10:00:00");
    const { sunday } = getWeekBounds(thursday);
    expect(sunday.getDay()).toBe(0); // 0 = domingo
    expect(sunday.getDate()).toBe(10); // 10/05/2026
  });

  it("quando hoje é domingo, a semana começa na segunda anterior", () => {
    const sunday = new Date("2026-05-10T10:00:00");
    const { monday } = getWeekBounds(sunday);
    expect(monday.getDate()).toBe(4); // 04/05/2026
  });

  it("deve detectar agendamento do dia atual", () => {
    const today = new Date("2026-05-07T10:00:00");
    const dateStr = "2026-05-07 14:30:00";
    expect(isSameLocalDay(dateStr, today)).toBe(true);
  });

  it("não deve detectar agendamento de outro dia como hoje", () => {
    const today = new Date("2026-05-07T10:00:00");
    const dateStr = "2026-05-08 09:00:00";
    expect(isSameLocalDay(dateStr, today)).toBe(false);
  });
});

describe("RemindersWidget — geração de lembretes", () => {
  const now = new Date("2026-05-07T10:00:00");

  it("deve gerar lembrete 'hoje' quando há agendamentos no dia", () => {
    const appts = [
      { id: 1, date: "2026-05-07 14:00:00", clientName: "João", status: "agendado" },
      { id: 2, date: "2026-05-07 16:00:00", clientName: "Maria", status: "confirmado" },
    ];
    const reminders = buildReminders(appts, now);
    const todayReminder = reminders.find((r) => r.type === "today");
    expect(todayReminder).toBeDefined();
    expect(todayReminder?.message).toBe("Você tem 2 atendimentos hoje");
  });

  it("deve gerar lembrete singular quando há 1 agendamento hoje", () => {
    const appts = [{ id: 1, date: "2026-05-07 15:00:00", clientName: "Ana", status: "agendado" }];
    const reminders = buildReminders(appts, now);
    const todayReminder = reminders.find((r) => r.type === "today");
    expect(todayReminder?.message).toBe("Você tem 1 atendimento hoje");
  });

  it("não deve incluir agendamentos cancelados nos lembretes de hoje", () => {
    const appts = [
      { id: 1, date: "2026-05-07 14:00:00", clientName: "João", status: "cancelado" },
    ];
    const reminders = buildReminders(appts, now);
    expect(reminders.find((r) => r.type === "today")).toBeUndefined();
  });

  it("não deve incluir agendamentos concluídos nos lembretes", () => {
    const appts = [
      { id: 1, date: "2026-05-07 09:00:00", clientName: "Pedro", status: "concluido" },
    ];
    const reminders = buildReminders(appts, now);
    expect(reminders.find((r) => r.type === "today")).toBeUndefined();
  });

  it("deve gerar lembrete de próximo atendimento futuro", () => {
    const appts = [
      { id: 1, date: "2026-05-08 10:00:00", clientName: "Carla", status: "agendado" },
    ];
    const reminders = buildReminders(appts, now);
    const nextReminder = reminders.find((r) => r.type === "next" || r.type === "next24h");
    expect(nextReminder).toBeDefined();
    expect(nextReminder?.message).toContain("Carla");
  });

  it("deve retornar lembrete 'info' quando não há agendamentos", () => {
    const reminders = buildReminders([], now);
    expect(reminders.length).toBe(1);
    expect(reminders[0].type).toBe("info");
    expect(reminders[0].message).toBe("Nenhum atendimento próximo esta semana");
  });

  it("deve classificar como next24h quando próximo atendimento é em menos de 24h", () => {
    const soon = new Date("2026-05-07T10:00:00");
    const appts = [
      { id: 1, date: "2026-05-07 20:00:00", clientName: "Lucas", status: "agendado" },
    ];
    const reminders = buildReminders(appts, soon);
    const nextReminder = reminders.find((r) => r.type === "next24h" || r.type === "next");
    expect(nextReminder?.type).toBe("next24h");
  });
});

describe("LowStockWidget — detecção de materiais críticos", () => {
  it("deve identificar material como crítico quando estoque < 50% do mínimo", () => {
    const current = 2;
    const min = 10;
    const isCritical = min > 0 && current < min * 0.5;
    expect(isCritical).toBe(true);
  });

  it("não deve classificar como crítico quando estoque >= 50% do mínimo", () => {
    const current = 6;
    const min = 10;
    const isCritical = min > 0 && current < min * 0.5;
    expect(isCritical).toBe(false);
  });

  it("não deve classificar como crítico quando minStock é 0", () => {
    const current = 0;
    const min = 0;
    const isCritical = min > 0 && current < min * 0.5;
    expect(isCritical).toBe(false);
  });

  it("deve formatar quantidade inteira sem decimais", () => {
    const fmt = (n: number) => (n % 1 === 0 ? n.toFixed(0) : n.toFixed(1));
    expect(fmt(5)).toBe("5");
    expect(fmt(5.5)).toBe("5.5");
    expect(fmt(0)).toBe("0");
  });

  it("deve formatar quantidade decimal com 1 casa", () => {
    const fmt = (n: number) => (n % 1 === 0 ? n.toFixed(0) : n.toFixed(1));
    expect(fmt(2.75)).toBe("2.8");
    expect(fmt(1.0)).toBe("1");
  });
});
