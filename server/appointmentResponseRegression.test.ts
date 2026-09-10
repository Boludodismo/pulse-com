import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => ({ getAppointmentById: vi.fn(), updateAppointment: vi.fn(), queueAnamneseAfterCustomerAction: vi.fn(), queueArtistActionNotification: vi.fn() }));
vi.mock("./db", () => mocks);
vi.mock("./appointmentActions", async original => ({ ...await original<typeof import("./appointmentActions")>(), queueAnamneseAfterCustomerAction: mocks.queueAnamneseAfterCustomerAction, queueArtistActionNotification: mocks.queueArtistActionNotification }));
import { appRouter } from "./routers";
const appointment = { id: 14, studioId: 7, date: "2026-10-16 13:00:00" };
const token = () => createHash("sha256").update(`${appointment.id}:${appointment.date}:${process.env.JWT_SECRET || "secret"}`).digest("hex").slice(0, 16);
const caller = () => appRouter.createCaller({ user: null, req: { headers: {} }, res: {} } as any);
beforeEach(() => { vi.clearAllMocks(); mocks.getAppointmentById.mockResolvedValue(appointment); mocks.updateAppointment.mockResolvedValue({}); mocks.queueAnamneseAfterCustomerAction.mockResolvedValue({ queued: true, anamneseUrl: "https://example.test/anamnese/test" }); mocks.queueArtistActionNotification.mockResolvedValue(true); });
describe("respostas públicas dos links legados", () => {
 it.each([["confirmado", "confirmed"], ["atraso", "late"], ["chegada_antecipada", "early"], ["nao_confirmado", "reschedule_requested"]] as const)("%s notifica artista e disponibiliza anamnese", async (status, action) => {
  const result = await caller().appointments.confirm({ id: 14, token: token(), status });
  expect(result).toMatchObject({ success: true, artistQueued: true, anamneseQueued: true });
  expect(mocks.queueArtistActionNotification).toHaveBeenCalledWith({ studioId: 7, appointmentId: 14, action, actionEventKey: `legacy:14:${status}:${token()}` });
  expect(mocks.queueAnamneseAfterCustomerAction).toHaveBeenCalledWith(expect.objectContaining({ studioId: 7, action }));
 });
 it("mantém o aviso ao artista quando falha a anamnese", async () => {
  mocks.queueAnamneseAfterCustomerAction.mockRejectedValueOnce(new Error("database failure"));
  expect(await caller().appointments.confirm({ id: 14, token: token(), status: "atraso" })).toMatchObject({ artistQueued: true, anamneseQueued: false });
 });
 it("rejeita token inválido sem salvar ou enviar", async () => {
  await expect(caller().appointments.confirm({ id: 14, token: "invalid", status: "confirmado" })).rejects.toThrow("Link inválido");
  expect(mocks.updateAppointment).not.toHaveBeenCalled(); expect(mocks.queueArtistActionNotification).not.toHaveBeenCalled(); expect(mocks.queueAnamneseAfterCustomerAction).not.toHaveBeenCalled();
 });
});
