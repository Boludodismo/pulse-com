import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
const state = vi.hoisted(() => ({ db: vi.fn(), send: vi.fn() }));
vi.mock("../db", () => ({ getDb: state.db }));
vi.mock("./service", () => ({ sendAndLog: state.send }));
import {
  artistNotificationRoute,
  artistNoticeContextError,
  isCoreArtistNotice,
  queueArtistAppointmentNotice,
  queueArtistCustomerReply,
  queueArtistOperationalNotice,
  selectArtistNoticeChannel,
} from "./artistNotifications";

let data: Record<string, any[]>;
let queries: Array<{ table: string; sql: string; params: unknown[] }>;
beforeEach(() => {
  vi.clearAllMocks();
  queries = [];
  data = {
    artists: [{ id: 7, name: "Ana Júlia", phone: "(31) 99999-8888" }],
    artist_notification_settings: [],
    whatsapp_integrations: [
      { id: 19, ownerRole: "admin", ownerArtistId: null },
    ],
    clients: [
      { id: 3, name: "Cliente de teste", phone: "+5531988887777", artistId: 7 },
    ],
    appointments: [
      {
        id: 14,
        studioId: 2,
        artistId: 7,
        artist: "Ana Júlia",
        clientId: 3,
        date: "2026-10-25 14:00:00",
        service: "Fine line",
        status: "agendado",
      },
    ],
  };
  state.db.mockResolvedValue({
    select: () => {
      let table = "";
      const q: any = {
        from: (value: any) => {
          table = getTableName(value);
          return q;
        },
        leftJoin: () => q,
        where: (condition: any) => {
          queries.push({ table, ...new MySqlDialect().sqlToQuery(condition) });
          return q;
        },
        orderBy: () => q,
        limit: async () => data[table] ?? [],
        then: (resolve: any) =>
          Promise.resolve(data[table] ?? []).then(resolve),
      };
      return q;
    },
  });
  state.send.mockResolvedValue({
    success: true,
    queued: true,
    duplicate: false,
  });
});
describe("artist operational notices through the studio WhatsApp", () => {
  it("validates care-event ownership at delivery even if the client owner differs", async () => {
    data.care_events=[{id:9,artistId:7,clientId:3,appointmentId:14,feedback:'Tudo bem'}];
    data.clients[0].artistId=8;
    const context={studioId:2,artistId:7,clientId:3,appointmentId:14,trigger:'care_artist_feedback:9'};
    expect(isCoreArtistNotice(context.trigger)).toBe(true);
    expect(await artistNoticeContextError(context)).toBeNull();
    expect(queries.find(q=>q.table==='care_events')?.params).toEqual([9,2]);
    data.care_events[0].artistId=8;
    expect(await artistNoticeContextError(context)).toContain('artista responsável');
    data.care_events=[];
    expect(await artistNoticeContextError(context)).toContain('artista responsável');
  });
  it("automatically sends a new appointment to the artist personal number, with date and actual context", async () => {
    expect(
      await queueArtistAppointmentNotice({
        studioId: 2,
        appointmentId: 14,
        change: "created",
      })
    ).toBe(true);
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({
        studioId: 2,
        integrationId: 19,
        artistId: 7,
        clientId: 3,
        appointmentId: 14,
        recipientType: "artist",
        recipientPhone: "+5531999998888",
      })
    );
    const sent = state.send.mock.calls[0][0];
    expect(sent.message).toContain("25/10/2026 às 14:00");
    expect(sent.message).toContain("Ana Júlia");
    expect(sent.message).toContain("Fine line");
    expect(queries.every(query => query.params.includes(2))).toBe(true);
    expect(
      queries.find(query => query.table === "whatsapp_integrations")?.sql
    ).toContain("sandbox_mode");
  });
  it("keeps new-appointment deduplication stable and separate from later updates", async () => {
    await queueArtistAppointmentNotice({
      studioId: 2,
      appointmentId: 14,
      change: "created",
    });
    await queueArtistAppointmentNotice({
      studioId: 2,
      appointmentId: 14,
      change: "created",
    });
    await queueArtistAppointmentNotice({
      studioId: 2,
      appointmentId: 14,
      change: "updated",
    });
    const keys = state.send.mock.calls.map(([p]) => p.idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
  });
  it("routes an ordinary customer reply using the explicitly linked appointment artist", async () => {
    data.clients[0].artistId = 9;
    expect(
      await queueArtistCustomerReply({
        studioId: 2,
        phone: "31988887777",
        text: "Posso chegar às 14h?",
        eventKey: "inbound-1",
        appointmentId: 14,
      })
    ).toBe(true);
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({
        artistId: 7,
        clientId: 3,
        appointmentId: 14,
        message: expect.stringContaining("Posso chegar às 14h?"),
      })
    );
  });
  it("routes a reply without appointment to the verified client artist and keeps the provider event key", async () => {
    await queueArtistCustomerReply({
      studioId: 2,
      phone: "+5531988887777",
      text: "Quero um orçamento",
      eventKey: "inbound-2",
    });
    expect(state.send).toHaveBeenCalledWith(
      expect.objectContaining({
        artistId: 7,
        idempotencyKey: "artist-reply:2:inbound-2",
      })
    );
  });
  it("does not invent a recipient for an unknown, ambiguous, or unassigned client", async () => {
    data.clients.push({ ...data.clients[0], id: 4 });
    expect(
      await queueArtistCustomerReply({
        studioId: 2,
        phone: "+5531988887777",
        text: "Olá",
        eventKey: "a",
      })
    ).toBe(false);
    data.clients = [];
    expect(
      await queueArtistCustomerReply({
        studioId: 2,
        phone: "+5531988887777",
        text: "Olá",
        eventKey: "b",
      })
    ).toBe(false);
    data.clients = [
      { id: 3, name: "Teste", phone: "+5531988887777", artistId: null },
    ];
    expect(
      await queueArtistCustomerReply({
        studioId: 2,
        phone: "+5531988887777",
        text: "Olá",
        eventKey: "c",
      })
    ).toBe(false);
    expect(state.send).not.toHaveBeenCalled();
  });
  it("does not send for missing artist phone, missing channel, unavailable provider, or missing event id", async () => {
    data.artists[0].phone = null;
    expect(
      await artistNotificationRoute(2, 7, "artist_appointment_created")
    ).toBeNull();
    data.artists[0].phone = "(31) 99999-8888";
    data.whatsapp_integrations = [];
    expect(
      await artistNotificationRoute(2, 7, "artist_customer_reply")
    ).toBeNull();
    expect(
      await queueArtistCustomerReply({
        studioId: 2,
        phone: "+5531988887777",
        text: "Oi",
      })
    ).toBe(false);
    data.whatsapp_integrations = [
      { id: 19, ownerRole: "admin", ownerArtistId: null },
    ];
    state.send.mockRejectedValueOnce(new Error("provider unavailable"));
    expect(
      await queueArtistAppointmentNotice({
        studioId: 2,
        appointmentId: 14,
        change: "created",
      })
    ).toBe(false);
  });
  it("preserves opt-in for personal integration and optional reminders, while the studio fallback is automatic", async () => {
    data.whatsapp_integrations.unshift({
      id: 20,
      ownerRole: "collaborator",
      ownerArtistId: 7,
    });
    expect(
      await artistNotificationRoute(2, 7, "artist_customer_reply")
    ).toBeNull();
    data.artist_notification_settings = [
      { whatsappOperationalEnabled: 1, notifyClientActionsEnabled: 1 },
    ];
    expect(
      await artistNotificationRoute(2, 7, "artist_customer_reply")
    ).toMatchObject({ integrationId: 20, viaStudio: false });
    data.whatsapp_integrations.shift();
    data.artist_notification_settings = [];
    expect(
      await artistNotificationRoute(
        2,
        7,
        "appointment_reminder_24h_artist_manual"
      )
    ).toBeNull();
    expect(
      await artistNotificationRoute(2, 7, "appointment_action_late")
    ).toMatchObject({ integrationId: 19, viaStudio: true });
  });
  it("never borrows another artist integration or accepts an unrelated trigger as mandatory", () => {
    expect(
      selectArtistNoticeChannel(
        [{ id: 20, ownerRole: "collaborator", ownerArtistId: 9 }],
        7
      )
    ).toBeNull();
    expect(isCoreArtistNotice("custom")).toBe(false);
    expect(isCoreArtistNotice("appointment_action_unknown")).toBe(false);
  });
  it("rechecks current ownership and rejects notifications after reassignment", async () => {
    const input = {
      studioId: 2,
      artistId: 7,
      clientId: 3,
      appointmentId: 14,
      trigger: "artist_customer_reply",
    };
    expect(await artistNoticeContextError(input)).toBeNull();
    data.appointments[0].artistId = 9;
    expect(await artistNoticeContextError(input)).toContain(
      "artista responsável"
    );
    data.appointments[0].clientId = 10;
    expect(await artistNoticeContextError(input)).toContain(
      "vínculo do cliente"
    );
    data.clients[0].artistId = 9;
    expect(
      await artistNoticeContextError({ ...input, appointmentId: undefined })
    ).toContain("atendimento mudou");
  });
  it("keeps duplicate queue results successful without adding another send mechanism", async () => {
    state.send.mockResolvedValue({
      success: true,
      queued: false,
      duplicate: true,
    });
    expect(
      await queueArtistOperationalNotice({
        studioId: 2,
        artistId: 7,
        trigger: "artist_customer_reply",
        message: "Teste",
        idempotencyKey: "same-event",
      })
    ).toBe(true);
    expect(state.send).toHaveBeenCalledTimes(1);
  });
});
