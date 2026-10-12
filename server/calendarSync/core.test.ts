import { describe, it, expect } from "vitest";
import {
  decideSync,
  eventHash,
  readIcs,
  writeIcs,
  wallToUtc,
  type SyncEvent,
} from "./core";
import { appleUrl } from "./providers";
import { ACCOUNT_TEMPLATES } from "../../shared/commitmentTemplates";
import { snapDragMinutes, dragDate } from "../../shared/visualDrag";
const event: SyncEvent = {
  date: "2026-10-12 14:35:00",
  duration: 60,
  allDay: false,
  title: "Sessão de tatuagem",
  uid: "appointment-7@tatuei.com",
};
describe("sincronização sem sobrescrita silenciosa", () => {
  it("cria somente quando não existe vínculo nem evento externo", () => {
    expect(decideSync(null, null, "a", null)).toBe("create");
    expect(decideSync(null, null, "a", "a")).toBe("link");
    expect(decideSync(null, null, "a", "b")).toBe("conflict");
  });
  it("direciona uma alteração de cada vez e bloqueia alterações simultâneas", () => {
    expect(decideSync("a", "a", "b", "a")).toBe("push");
    expect(decideSync("a", "a", "a", "b")).toBe("pull");
    expect(decideSync("a", "a", "b", "c")).toBe("conflict");
    expect(decideSync("a", "a", "b", "b")).toBe("link");
    expect(decideSync("a", "a", "a", null)).toBe("conflict");
    expect(decideSync("a", "a", "a", "a")).toBe("none");
  });
  it("não transforma edição de título em loop de reagendamento", () => {
    expect(eventHash(event)).toBe(
      eventHash({ ...event, title: "Título editado externamente" })
    );
    expect(eventHash(event)).not.toBe(
      eventHash({ ...event, date: "2026-10-12 15:00:00" })
    );
  });
  it("converte Brasília para UTC e faz round-trip com horário e duração", () => {
    expect(wallToUtc(event.date, "America/Sao_Paulo").toISOString()).toBe(
      "2026-10-12T17:35:00.000Z"
    );
    const ics = writeIcs(event, "America/Sao_Paulo");
    expect(readIcs(ics, "America/Sao_Paulo")).toMatchObject({
      date: event.date,
      duration: 60,
      allDay: false,
      uid: event.uid,
    });
  });
  it("preserva data dos eventos de dia inteiro", () => {
    const dateEvent = {
      ...event,
      date: "2026-10-12",
      duration: 1,
      allDay: true,
    };
    const ics = writeIcs(dateEvent, "America/Sao_Paulo");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261012");
    expect(readIcs(ics, "America/Sao_Paulo")).toMatchObject({
      date: "2026-10-12",
      duration: 1,
      allDay: true,
    });
  });
  it("não importa recorrência externa como uma sessão isolada", () => {
    const ics = writeIcs(event, "America/Sao_Paulo").replace(
      "END:VEVENT",
      "RRULE:FREQ=WEEKLY\r\nEND:VEVENT"
    );
    expect(() => readIcs(ics, "America/Sao_Paulo")).toThrow("recorrente");
  });
  it("bloqueia destinos CalDAV fora da Apple", () => {
    expect(appleUrl("https://p123-caldav.icloud.com/123/calendar/")).toContain(
      "icloud.com"
    );
    for (const url of [
      "http://p123-caldav.icloud.com/",
      "https://icloud.com.evil.example/",
      "https://127.0.0.1/",
      "https://user:secret@p123-caldav.icloud.com/",
    ])
      expect(() => appleUrl(url)).toThrow();
  });
});
describe("cadastro e precisão visual", () => {
  it("oferece dez modelos distintos sem valores ou vencimentos inventados", () => {
    expect(ACCOUNT_TEMPLATES).toHaveLength(10);
    expect(new Set(ACCOUNT_TEMPLATES.map(t => t.id)).size).toBe(10);
    expect(
      ACCOUNT_TEMPLATES.every(t => !("amount" in t) && !("startDate" in t))
    ).toBe(true);
  });
  it("mostra o mesmo destino no indicador e na confirmação sem estourar o dia", () => {
    expect(snapDragMinutes(14 * 60 + 34, 60)).toBe(14 * 60 + 35);
    expect(dragDate("2026-10-12", snapDragMinutes(14 * 60 + 34, 60))).toBe(
      "2026-10-12 14:35:00"
    );
    expect(snapDragMinutes(-40, 90)).toBe(0);
    expect(snapDragMinutes(1439, 90)).toBe(1350);
  });
});
