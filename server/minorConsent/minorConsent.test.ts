import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import {
  validCpf,
  ageAtDate,
  submissionSchema,
  validateSubmission,
  MINOR_CONSENT_TERMS,
} from "../../shared/minorConsent";
import { sha, sealConsentBackup, openConsentBackup } from "./backup";

const mock = vi.hoisted(() => ({
  record: {} as any,
  files: [] as any[],
  storage: new Map<string, Buffer>(),
  commit: vi.fn(),
  rollback: vi.fn(),
  audit: vi.fn(),
  queries: [] as any[],
  anamneseComplete: true,
}));
vi.mock("../saas", () => ({ isUserAccessActive: async () => true }));
vi.mock("../invitedArtistAccess", () => ({
  assertInvitedArtistAccess: async () => {},
}));
vi.mock("../security/rateLimit", () => ({ enforceRateLimit: async () => {} }));
vi.mock("../_core/env", () => ({
  ENV: {
    appBaseUrl: "https://crm.example.test",
    authSecurityKey: "test-only-secret".repeat(4),
  },
}));
vi.mock("../security/anamneseAccess", () => ({
  assertAnamneseClient: async (user: any, id: number) => {
    if (user.studioId !== 1 || id !== 7) throw new Error("Forbidden tenant");
    return { id: 7, studioId: 1, name: "Pessoa Teste", artistId: 9 };
  },
}));
vi.mock("../db", () => ({
  getClientById: async () => ({
    id: 7,
    name: "Pessoa Teste",
    birthDate: "2010-02-03",
    docNumber: "",
    phone: "31999999999",
  }),
  getStudioSettings: async () => ({
    studioName: "Estúdio Teste",
    address: "Rua de Teste, 10",
    city: "Curvelo",
    state: "MG",
    phone: "31999999999",
  }),
  listArtists: async () => [{ id: 9, name: "Artista Teste", active: 1 }],
  getArtistById: async () => ({ id: 9, name: "Artista Teste", active: 1 }),
  createAnamneseRequest: async () => 99,
}));
vi.mock("../storage", () => ({
  storagePut: async (key: string, data: Buffer) => {
    mock.storage.set(key, Buffer.from(data));
    return { key, url: "private-unused" };
  },
  storageReadBuffer: async (key: string) => {
    const b = mock.storage.get(key);
    if (!b) throw new Error("missing");
    return b;
  },
}));
vi.mock("./database", () => {
  const query = async (sql: string, params: any[] = []) => {
    mock.queries.push([sql, params]);
    if (sql.startsWith("INSERT INTO minor_consent_files")) {
      const [
        id,
        request_id,
        studio_id,
        kind,
        name,
        mime,
        bytes,
        hash,
        storage_key,
        document_hash,
      ] = params;
      mock.files = mock.files.filter(f => f.kind !== kind);
      mock.files.push({
        id,
        request_id,
        studio_id,
        kind,
        name,
        mime,
        bytes,
        sha256: hash,
        storage_key,
        document_hash,
      });
    }
    if (sql.includes("SET prepared_hash=")) {
      mock.record.prepared_hash = params[0];
      mock.record.prepared_pdf_key = params[1];
    }
    if (sql.includes("SET status='received'")) {
      mock.record.status = "received";
      mock.record.submission_json = params[0];
      mock.record.submission_hash = params[1];
      mock.record.submitted_at = "2026-10-17";
    }
    return [{ insertId: 11, affectedRows: 1 }];
  };
  const rows = async (sql: string) => {
    if (sql.includes("GET_LOCK")) return [{ ok: 1 }];
    if (sql.includes("SELECT * FROM minor_consent_requests"))
      return [mock.record];
    if (sql.includes("SUM(bytes)"))
      return [{ total: mock.files.reduce((n, f) => n + f.bytes, 0) }];
    if (sql.includes("SELECT kind,sha256"))
      return mock.files
        .filter(
          f =>
            ![
              "unsigned_pdf",
              "signed_pdf",
              "signed_simple",
              "validation_report",
            ].includes(f.kind)
        )
        .sort((a, b) => a.kind.localeCompare(b.kind))
        .map(({ kind, sha256 }) => ({ kind, sha256 }));
    if (sql.includes("FROM minor_consent_files")) return mock.files;
    if (sql.includes("FROM anamnese_submissions"))
      return mock.anamneseComplete
        ? [{ id: 8, payloadJson: '{"health":"answered"}' }]
        : [];
    if (sql.includes("SELECT statusRequest"))
      return [
        { statusRequest: mock.anamneseComplete ? "preenchida" : "pendente" },
      ];
    if (sql.includes("tattoo_consent_templates")) return [];
    if (sql.includes("FROM anamnese_requests"))
      return [{ token: "b".repeat(64), statusRequest: "preenchida" }];
    return [];
  };
  const connection = {
    query,
    beginTransaction: async () => {},
    commit: mock.commit,
    rollback: mock.rollback,
    release: () => {},
  };
  return {
    rows,
    pool: () => ({ query, getConnection: async () => connection }),
    audit: mock.audit,
  };
});
import { minorConsentRouter } from "./router";
const token = "a".repeat(64);
const template = {
  studioName: "Estúdio Teste",
  address: "Rua de Teste, 10, Curvelo MG",
  professionalName: "Artista Teste",
  professionalDocument: "",
  contact: "31999999999",
  jurisdiction: "Curvelo / MG",
  logo: "",
  terms: MINOR_CONSENT_TERMS,
};
const procedure = {
  description: "Arte aprovada de teste",
  bodyRegion: "braço",
  side: "direito",
  size: "10 cm",
  colors: "Preto",
  plannedDate: "2026-10-17",
};
let png = "";
function submission(mode: "simple" | "external" = "simple") {
  return submissionSchema.parse({
    minor: {
      name: "Pessoa Menor Teste",
      birthDate: "2010-02-03",
      documentType: "CPF",
      documentNumber: "529.982.247-25",
      sex: "masculino",
      address: "Rua de Teste, 10, Curvelo MG",
    },
    guardian: {
      name: "Responsável de Teste",
      documentType: "CPF",
      documentNumber: "168.995.350-09",
      relationship: "mae",
      address: "Rua de Teste, 10, Curvelo MG",
      phone: "31999999999",
    },
    signatureMode: mode,
    minorSignature: png,
    guardianSignature: mode === "simple" ? png : "",
    consent: true,
    assent: true,
    authorityDeclaration: true,
    privacyAcknowledged: true,
  });
}
const caller = (studio = 1, role = "admin", artistId: number | null = null) =>
  minorConsentRouter.createCaller({
    user: { id: 3, role, studioId: studio, artistId, name: "Artista" } as any,
    req: {
      ip: "127.0.0.1",
      socket: { remoteAddress: "127.0.0.1" },
      headers: { "user-agent": "unit-test" },
    } as any,
    res: {} as any,
  });
async function docs() {
  for (const kind of ["minor_document", "guardian_document"] as const)
    await caller().publicUpload({
      token,
      kind,
      file: {
        name: kind + ".pdf",
        data: Buffer.from("%PDF-1.7\nfixture identity").toString("base64"),
      },
    });
}
beforeEach(async () => {
  vi.clearAllMocks();
  mock.queries = [];
  mock.files = [];
  mock.storage.clear();
  mock.anamneseComplete = true;
  mock.record = {
    id: 11,
    studio_id: 1,
    client_id: 7,
    artist_id: 9,
    status: "pending",
    token_hash: sha(token),
    expires_at: Date.now() + 600000,
    template_json: JSON.stringify(template),
    procedure_json: JSON.stringify(procedure),
    anamnese_request_id: null,
    revision: 0,
  };
  const bytes = await sharp({
    create: { width: 150, height: 40, channels: 4, background: "black" },
  })
    .png()
    .toBuffer();
  png = "data:image/png;base64," + bytes.toString("base64");
});
describe("authorization data and integrity", () => {
  it("creates one linked anamnese and protects reusable invitation links in the same transaction", async () => {
    const input = {
      clientId: 7,
      artistId: 9,
      template,
      procedure,
      includeAnamnese: true as const,
      legalReviewDeclared: true as const,
    };
    const result = await caller().create(input);
    expect(result.anamneseLink).toMatch(
      /\/anamnese\/[a-f0-9]{64}\?autorizacao=[a-f0-9]{64}$/
    );
    expect(
      mock.queries.filter(([sql]) =>
        sql.startsWith("INSERT INTO anamnese_requests")
      )
    ).toHaveLength(1);
    const saved = mock.queries.find(([sql]) =>
      sql.startsWith("INSERT INTO minor_consent_invitations")
    );
    expect(saved).toBeTruthy();
    expect(saved![1][2]).not.toContain(result.link.split("/").pop());
    expect(mock.commit).toHaveBeenCalledOnce();
    mock.queries = [];
    await expect(
      caller().create({ ...input, includeAnamnese: false as any })
    ).rejects.toThrow();
    expect(mock.queries).toHaveLength(0);
  });
  it("checks CPF digits and exact birthdays, including invalid calendar dates", () => {
    expect(validCpf("52998224725")).toBe(true);
    expect(validCpf("00000000000")).toBe(false);
    expect(validCpf("52998224724")).toBe(false);
    expect(ageAtDate("2008-10-18", "2026-10-17")).toBe(17);
    expect(ageAtDate("2008-10-17", "2026-10-17")).toBe(18);
    expect(() => ageAtDate("2010-02-30")).toThrow();
  });
  it("rejects an adult, absent parent signature and unconfirmed declarations", () => {
    const s = submission();
    expect(() =>
      validateSubmission(
        { ...s, minor: { ...s.minor, birthDate: "2000-01-01" } },
        procedure.plannedDate
      )
    ).toThrow();
    expect(() =>
      validateSubmission({ ...s, guardianSignature: "" }, procedure.plannedDate)
    ).toThrow();
    expect(submissionSchema.safeParse({ ...s, consent: false }).success).toBe(
      false
    );
  });
  it("restores encrypted attachments and rejects a changed ciphertext or wrong key", () => {
    const source = {
      record: { id: 1 },
      attachments: [
        {
          sha256: sha(Buffer.from("bytes")),
          data: Buffer.from("bytes").toString("base64"),
        },
      ],
    };
    const sealed = sealConsentBackup(source);
    expect(openConsentBackup(sealed)).toEqual(source);
    const tampered = Buffer.from(sealed);
    tampered[tampered.length - 1] ^= 1;
    expect(() => openConsentBackup(tampered)).toThrow();
    expect(() =>
      openConsentBackup(sealed, "different-secret".repeat(4))
    ).toThrow();
  });
});
describe("public and private workflow", () => {
  it("rejects expired links without returning identity data or accepting uploads", async () => {
    mock.record.expires_at = Date.now() - 1;
    await expect(caller().publicGet({ token })).rejects.toThrow(/expirado/);
    await expect(
      caller().publicUpload({
        token,
        kind: "minor_document",
        file: {
          name: "doc.pdf",
          data: Buffer.from("%PDF-x").toString("base64"),
        },
      })
    ).rejects.toThrow();
    expect(mock.storage.size).toBe(0);
  });
  it("denies another studio and another artist access to private files", async () => {
    await expect(caller(2).detail({ id: 11 })).rejects.toThrow();
    await expect(
      caller(1, "collaborator", 22).detail({ id: 11 })
    ).rejects.toThrow();
  });
  it("requires both identities and the linked anamnese before submission", async () => {
    await expect(
      caller().submit({ token, submission: submission() })
    ).rejects.toThrow(/documento/);
    await docs();
    mock.record.anamnese_request_id = 99;
    mock.anamneseComplete = false;
    await expect(
      caller().submit({ token, submission: submission() })
    ).rejects.toThrow(/anamnese/);
    expect(mock.commit).not.toHaveBeenCalled();
  });
  it("stores a signed simple PDF, closes public editing and returns only a receipt", async () => {
    await docs();
    expect(
      await caller().submit({ token, submission: submission() })
    ).toMatchObject({ received: true, verification: "pending" });
    expect(mock.commit).toHaveBeenCalledOnce();
    const pdf = mock.files.find(f => f.kind === "signed_simple");
    expect(mock.storage.get(pdf.storage_key)?.subarray(0, 5).toString()).toBe(
      "%PDF-"
    );
    expect(await caller().publicGet({ token })).toEqual({
      received: true,
      id: 11,
      status: "received",
    });
    await expect(
      caller().publicUpload({
        token,
        kind: "minor_document",
        file: { name: "x.pdf", data: Buffer.from("%PDF-x").toString("base64") },
      })
    ).rejects.toThrow(/já foi enviada/);
  });
  it("preserves the exact external signed PDF and does not call it validated", async () => {
    await docs();
    const s = submission("external");
    await caller().prepare({ token, submission: s });
    const original = Buffer.from(
      "%PDF-1.7\n externally signed bytes untouched"
    );
    await caller().publicUpload({
      token,
      kind: "signed_pdf",
      file: { name: "signed.pdf", data: original.toString("base64") },
    });
    const file = mock.files.find(f => f.kind === "signed_pdf");
    await caller().submit({ token, submission: s });
    expect(mock.storage.get(file.storage_key)).toEqual(original);
    expect(mock.record.status).toBe("received");
    expect(mock.files.some(f => f.kind === "signed_simple")).toBe(false);
  });
  it("rejects altered fields or replaced identity attachments after preparing an external signature", async () => {
    await docs();
    const s = submission("external");
    await caller().prepare({ token, submission: s });
    await caller().publicUpload({
      token,
      kind: "signed_pdf",
      file: {
        name: "signed.pdf",
        data: Buffer.from("%PDF-signature").toString("base64"),
      },
    });
    await expect(
      caller().submit({
        token,
        submission: {
          ...s,
          minor: { ...s.minor, name: "Outro Nome Diferente" },
        },
      })
    ).rejects.toThrow(/dados mudaram/);
    await caller().publicUpload({
      token,
      kind: "minor_document",
      file: {
        name: "replacement.pdf",
        data: Buffer.from("%PDF-replacement").toString("base64"),
      },
    });
    await expect(caller().submit({ token, submission: s })).rejects.toThrow(
      /dados mudaram/
    );
    expect(mock.commit).not.toHaveBeenCalled();
  });
  it("requires evidence of tutorship and a validation report before approving an external PDF", async () => {
    await docs();
    const s = {
      ...submission(),
      guardian: { ...submission().guardian, relationship: "tutor" as const },
    };
    await expect(caller().submit({ token, submission: s })).rejects.toThrow(
      /representação/
    );
    mock.record.submitted_at = "2026-10-17";
    mock.record.submission_json = JSON.stringify(submission("external"));
    await expect(
      caller().review({
        id: 11,
        decision: "approved",
        identitiesChecked: true,
        localRulesChecked: true,
        contentChecked: true,
        digitalSignaturesChecked: true,
        notes: "Documentos conferidos",
      })
    ).rejects.toThrow(/relatório/);
  });
});
