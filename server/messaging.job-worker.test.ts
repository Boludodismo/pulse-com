import { afterEach, describe, expect, it, vi } from "vitest";
import { createIntegrationJobWorker } from "./messaging/jobWorker";
import { isExpiredAppointmentReminder } from "./messaging/service";

afterEach(() => {
  vi.useRealTimers();
});

describe("integration job worker", () => {
  it("processa a fila mesmo sem o scheduler de lembretes", async () => {
    vi.useFakeTimers();
    const processJobs = vi.fn().mockResolvedValue({ processed: 1 });
    const worker = createIntegrationJobWorker({ processJobs, initialDelayMs: 100, intervalMs: 1_000, limit: 20 });

    worker.start();
    await vi.advanceTimersByTimeAsync(100);

    expect(processJobs).toHaveBeenCalledTimes(1);
    expect(processJobs).toHaveBeenCalledWith(20);
    worker.stop();
  });

  it("não inicia dois ciclos concorrentes", async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const processJobs = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const worker = createIntegrationJobWorker({ processJobs, initialDelayMs: 10, intervalMs: 20 });

    worker.start();
    await vi.advanceTimersByTimeAsync(100);
    expect(processJobs).toHaveBeenCalledTimes(1);

    finish();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(20);
    expect(processJobs).toHaveBeenCalledTimes(2);
    worker.stop();
  });

  it("pode ser iniciado apenas uma vez", async () => {
    vi.useFakeTimers();
    const processJobs = vi.fn().mockResolvedValue(undefined);
    const worker = createIntegrationJobWorker({ processJobs, initialDelayMs: 50 });

    worker.start();
    worker.start();
    await vi.advanceTimersByTimeAsync(50);

    expect(processJobs).toHaveBeenCalledTimes(1);
    worker.stop();
  });
});

describe("proteção da fila antiga", () => {
  it("expira lembrete de agendamento passado", () => {
    expect(isExpiredAppointmentReminder("appointment_reminder_24h", "2026-09-09 11:30:00", "agendado", Date.parse("2026-09-10T12:00:00"))).toBe(true);
  });

  it("mantém lembrete futuro e mensagens sem gatilho de agenda", () => {
    const now = Date.parse("2026-09-10T12:00:00");
    expect(isExpiredAppointmentReminder("appointment_reminder_24h", "2026-09-11 11:30:00", "agendado", now)).toBe(false);
    expect(isExpiredAppointmentReminder("post_sale_30d", "2026-09-09 11:30:00", "concluido", now)).toBe(false);
  });
});
