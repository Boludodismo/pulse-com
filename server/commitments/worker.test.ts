import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  query: vi.fn(),
  send: vi.fn(),
  getIntegration: vi.fn(),
  claimed: new Set<string>(),
  consent: true,
  status: "pending",
  revision: 0,
}));
vi.mock("./db", () => ({
  ensureCommitmentsSchema: async () => {},
  seriesSelect: "s.id",
  occurrenceSelect: "o.id",
  database: () => ({
    query: m.query,
    getConnection: async () => ({
      query: m.query,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
    }),
  }),
}));
vi.mock("../messaging/service", () => ({
  getActiveIntegration: m.getIntegration,
  getProviderForIntegration: async () => ({ sendMessage: m.send }),
}));
vi.mock("../messaging/outboundSafety", () => ({
  isOutboundMessagingBlocked: () => false,
}));
import { runCommitmentCycle } from "./service";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
  vi.stubEnv("DATABASE_URL", "test-only");
  vi.clearAllMocks();
  m.claimed.clear();
  m.consent = true;
  m.status = "pending";
  m.revision = 0;
  m.getIntegration.mockResolvedValue({
    isEnabled: 1,
    status: "ativo",
    sandboxMode: 0,
  });
  m.send.mockResolvedValue({ success: true });
  m.query.mockImplementation(async (sql: string, args: any[] = []) => {
    if (sql.includes("SELECT p.*,u.name"))
      return [
        m.consent
          ? [
              {
                studio_id: 7,
                user_id: 11,
                phone: "+5531996531316",
                name: "Maria Fernanda Souza",
                timezone: "America/Sao_Paulo",
                before_time: "09:00",
                first_time: "09:00",
                second_time: "16:00",
              },
            ]
          : [],
      ];
    if (sql.includes("SELECT s.id FROM commitment_series")) return [[]];
    if (sql.includes("o.status,o.revision,s.active"))
      return [[{ status: m.status, revision: m.revision, active: 1 }]];
    if (sql.includes("SELECT o.status,o.revision"))
      return [m.consent ? [{ status: m.status, revision: m.revision }] : []];
    if (sql.includes("SELECT o.id FROM commitment_occurrences"))
      return [
        [
          {
            id: 21,
            effectiveDate: "2026-10-12",
            originalDate: "2026-10-12",
            revision: 0,
            title: "Internet",
            category: "fixed",
            amount: 9900,
            snoozeUntil: null,
          },
        ],
      ];
    if (sql.includes("INSERT IGNORE INTO commitment_deliveries")) {
      const key = args.join(":");
      const duplicate = m.claimed.has(key);
      m.claimed.add(key);
      return [{ affectedRows: duplicate ? 0 : 1 }];
    }
    return [{}];
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
describe("envios de compromissos", () => {
  it("envia três avisos separados e não repete um slot", async () => {
    vi.setSystemTime(new Date("2026-10-11T12:00:00Z"));
    await runCommitmentCycle();
    await runCommitmentCycle();
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    await runCommitmentCycle();
    await runCommitmentCycle();
    vi.setSystemTime(new Date("2026-10-12T19:00:00Z"));
    await runCommitmentCycle();
    expect(m.send).toHaveBeenCalledTimes(3);
    expect(m.send.mock.calls[0][1]).toContain("Olá, Maria!");
    expect(m.send.mock.calls[0][1]).toContain(
      "/commitments?occurrence=21&action=paid"
    );
    expect(m.getIntegration).toHaveBeenCalledWith(7);
  });
  it("não envia sem consentimento nem em conexão sandbox", async () => {
    m.consent = false;
    await runCommitmentCycle();
    expect(m.send).not.toHaveBeenCalled();
    m.consent = true;
    m.getIntegration.mockResolvedValue({
      isEnabled: 1,
      status: "ativo",
      sandboxMode: 1,
    });
    await runCommitmentCycle();
    expect(m.send).not.toHaveBeenCalled();
  });
  it("não repete entrega cujo resultado é incerto", async () => {
    m.send.mockRejectedValue(new Error("timeout"));
    await runCommitmentCycle();
    await runCommitmentCycle();
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(
      m.query.mock.calls.some(c => c[0].includes("state='uncertain'"))
    ).toBe(true);
  });
  it("confirma revisão antes de entregar e ignora ocorrência encerrada", async () => {
    m.revision = 1;
    await runCommitmentCycle();
    expect(m.send).not.toHaveBeenCalled();
    m.revision = 0;
    m.status = "paid";
    await runCommitmentCycle();
    expect(m.send).not.toHaveBeenCalled();
  });
});
