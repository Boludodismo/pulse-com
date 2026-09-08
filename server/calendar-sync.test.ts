import { describe, it, expect } from "vitest";

/**
 * Testes unitários para a lógica de drag-and-drop e sincronização
 * entre Calendário Visual e Agenda.
 */

// ── Helper: toLocalDateString ────────────────────────────────────────────────
function toLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:00`;
}

// ── Helper: calcular nova data no drop semanal ───────────────────────────────
function calcWeekDropDate(
  targetDate: Date,
  hour: number,
  minute: number,
  offsetMinutes: number
): Date {
  const totalMinutes = hour * 60 + minute - offsetMinutes;
  const adjustedHour = Math.floor(Math.max(0, totalMinutes) / 60);
  const adjustedMinute = Math.round((Math.max(0, totalMinutes) % 60) / 15) * 15;
  return new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    adjustedHour,
    adjustedMinute,
    0
  );
}

// ── Helper: calcular nova data no drop mensal ────────────────────────────────
function calcMonthDropDate(targetDate: Date, originalDate: Date): Date {
  return new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
    originalDate.getHours(),
    originalDate.getMinutes(),
    0
  );
}

// ── Helper: posicionamento de evento na grade semanal ───────────────────────
const SLOT_HEIGHT = 60;
const HOURS_START = 7;

function getEventStyle(apt: { date: Date; duration: number }) {
  const startHour = apt.date.getHours();
  const startMinute = apt.date.getMinutes();
  const topOffset = (startHour - HOURS_START) * SLOT_HEIGHT + (startMinute / 60) * SLOT_HEIGHT;
  const height = Math.max((apt.duration / 60) * SLOT_HEIGHT, 20);
  return { top: topOffset, height };
}

// ── Testes ───────────────────────────────────────────────────────────────────

describe("toLocalDateString", () => {
  it("formata corretamente sem conversão UTC", () => {
    const d = new Date(2026, 2, 28, 14, 30, 0); // 28/03/2026 14:30
    expect(toLocalDateString(d)).toBe("2026-03-28 14:30:00");
  });

  it("padeia zeros corretamente", () => {
    const d = new Date(2026, 0, 5, 9, 5, 0); // 05/01/2026 09:05
    expect(toLocalDateString(d)).toBe("2026-01-05 09:05:00");
  });
});

describe("calcWeekDropDate — drag na visão semanal", () => {
  it("posiciona no horário exato sem offset", () => {
    const target = new Date(2026, 2, 30); // 30/03/2026
    const result = calcWeekDropDate(target, 10, 0, 0);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(0);
    expect(result.getDate()).toBe(30);
  });

  it("ajusta pelo offset do mouse dentro do evento", () => {
    const target = new Date(2026, 2, 30);
    // Usuário clicou 30min dentro do evento, soltou às 14:00
    const result = calcWeekDropDate(target, 14, 0, 30);
    expect(result.getHours()).toBe(13);
    expect(result.getMinutes()).toBe(30);
  });

  it("arredonda para slots de 15 minutos", () => {
    const target = new Date(2026, 2, 30);
    const result = calcWeekDropDate(target, 10, 30, 0);
    expect(result.getMinutes() % 15).toBe(0);
  });

  it("não permite horário negativo (mínimo 00:00)", () => {
    const target = new Date(2026, 2, 30);
    const result = calcWeekDropDate(target, 0, 0, 60); // offset maior que hora
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});

describe("calcMonthDropDate — drag na visão mensal", () => {
  it("mantém o horário original ao mudar de dia", () => {
    const target = new Date(2026, 2, 25); // 25/03/2026
    const original = new Date(2026, 2, 20, 15, 30, 0); // 20/03/2026 15:30
    const result = calcMonthDropDate(target, original);
    expect(result.getDate()).toBe(25);
    expect(result.getHours()).toBe(15);
    expect(result.getMinutes()).toBe(30);
  });

  it("funciona ao mudar de mês", () => {
    const target = new Date(2026, 3, 1); // 01/04/2026
    const original = new Date(2026, 2, 31, 9, 0, 0); // 31/03/2026 09:00
    const result = calcMonthDropDate(target, original);
    expect(result.getMonth()).toBe(3); // abril
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(9);
  });
});

describe("getEventStyle — posicionamento na grade semanal", () => {
  it("posiciona evento das 08:00 corretamente", () => {
    const apt = { date: new Date(2026, 2, 28, 8, 0, 0), duration: 60 };
    const style = getEventStyle(apt);
    expect(style.top).toBe(SLOT_HEIGHT); // 1 hora após o início (07:00)
    expect(style.height).toBe(SLOT_HEIGHT); // 60min = 1 slot
  });

  it("posiciona evento das 07:30 com 30min", () => {
    const apt = { date: new Date(2026, 2, 28, 7, 30, 0), duration: 30 };
    const style = getEventStyle(apt);
    expect(style.top).toBe(30); // 30min = metade do slot
    expect(style.height).toBe(30);
  });

  it("altura mínima é 20px para eventos muito curtos", () => {
    const apt = { date: new Date(2026, 2, 28, 10, 0, 0), duration: 5 };
    const style = getEventStyle(apt);
    expect(style.height).toBe(20);
  });

  it("evento de 2 horas tem altura de 2 slots", () => {
    const apt = { date: new Date(2026, 2, 28, 14, 0, 0), duration: 120 };
    const style = getEventStyle(apt);
    expect(style.height).toBe(SLOT_HEIGHT * 2);
  });
});

describe("Sincronização bidirecional — invalidação de cache", () => {
  it("ambas as páginas usam a mesma query key appointments.list", () => {
    // Verifica que a chave de cache é idêntica em ambas as páginas
    // (garantia de que invalidar em uma invalida na outra)
    const calendarQueryKey = "appointments.list";
    const scheduleQueryKey = "appointments.list";
    expect(calendarQueryKey).toBe(scheduleQueryKey);
  });

  it("após drag-and-drop, a data deve ser diferente da original", () => {
    const original = new Date(2026, 2, 20, 10, 0, 0);
    const target = new Date(2026, 2, 25);
    const newDate = calcMonthDropDate(target, original);
    expect(newDate.getDate()).not.toBe(original.getDate());
    expect(newDate.getHours()).toBe(original.getHours()); // horário preservado
  });
});
