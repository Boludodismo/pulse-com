import { z } from "zod";

const mediaUrl = z.string().max(3000).refine((value) => {
  if (value.startsWith("/api/storage?")) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}, "Endereço de imagem inválido.");

export const quoteMediaSchema = z.object({
  key: z.string().min(1).max(500),
  url: mediaUrl,
  alt: z.string().max(200).default(""),
  x: z.number().min(0).max(100).default(50),
  y: z.number().min(0).max(100).default(50),
  zoom: z.number().min(1).max(3).default(1),
}).strict();

export type QuoteMedia = z.infer<typeof quoteMediaSchema>;

export const quoteEditorDataSchema = z.object({
  project: z.object({
    title: z.string().trim().max(160).default("Projeto de tatuagem"),
    style: z.string().trim().max(120).default(""),
    bodyRegion: z.string().trim().max(120).default(""),
    sizeText: z.string().trim().max(120).default(""),
    durationText: z.string().trim().max(120).default(""),
    sessions: z.number().int().min(1).max(30).default(1),
    concept: z.string().trim().max(1600).default(""),
  }).strict(),
  media: z.object({
    clientReference: quoteMediaSchema.nullable().default(null),
    suggestedArtwork: quoteMediaSchema.nullable().default(null),
    coverSource: z.enum(["reference", "suggested"]).default("reference"),
  }).strict(),
  pricing: z.object({
    mainLabel: z.string().trim().max(120).default("Projeto e execução"),
    totalAmount: z.number().int().min(0).max(100_000_000).default(0),
    depositAmount: z.number().int().min(0).max(100_000_000).default(0),
    showDeposit: z.boolean().default(true),
    installmentText: z.string().trim().max(120).default(""),
  }).strict(),
  terms: z.string().trim().max(1800).default(""),
  logoSource: z.enum(["personal", "studio", "none"]).default("studio"),
  watermarkOpacity: z.number().int().min(20).max(100).default(70),
}).strict();

export type QuoteEditorData = z.infer<typeof quoteEditorDataSchema>;

const nullableShort = z.string().max(500).nullable();

export const quoteStoredPayloadSchema = z.object({
  version: z.literal(1),
  editor: quoteEditorDataSchema,
  client: z.object({
    id: z.number().int().positive(),
    name: z.string().max(255),
    email: nullableShort,
    phone: nullableShort,
  }).strict(),
  artist: z.object({
    id: z.number().int().positive(),
    name: z.string().max(255),
    bio: z.string().nullable(),
    specialty: nullableShort,
    photoUrl: z.string().max(3000).nullable(),
    phone: nullableShort,
    email: nullableShort,
    instagram: nullableShort,
  }).strict(),
  studio: z.object({
    name: nullableShort,
    logoUrl: z.string().max(3000).nullable(),
    phone: nullableShort,
    email: nullableShort,
    instagram: nullableShort,
  }).strict(),
  branding: z.object({
    personalLogoUrl: z.string().max(3000).nullable(),
    personalLogoKey: nullableShort,
  }).strict(),
}).strict();

export type QuoteStoredPayload = z.infer<typeof quoteStoredPayloadSchema>;

export const QUOTE_PRESET_CATEGORIES = ["concept", "terms", "bio", "payment", "notes"] as const;
export type QuotePresetCategory = (typeof QUOTE_PRESET_CATEGORIES)[number];

export const DEFAULT_CONCEPT_PRESETS = [
  {
    name: "Realismo personalizado",
    content: "A proposta será desenvolvida de forma personalizada, valorizando o fluxo anatômico da região e preservando profundidade, contraste e leitura visual. A referência será reinterpretada para resultar em uma composição exclusiva e adequada ao corpo.",
  },
  {
    name: "Projeto autoral",
    content: "O projeto será criado a partir das referências e da história apresentadas pelo cliente, com liberdade artística para construir uma composição original, equilibrada e coerente com a linguagem visual do artista.",
  },
  {
    name: "Adaptação corporal",
    content: "A composição será ajustada às proporções e ao movimento natural da região escolhida, priorizando encaixe anatômico, legibilidade dos elementos e uma leitura harmoniosa da tatuagem no corpo.",
  },
  {
    name: "Cobertura / transformação",
    content: "A proposta considera a tatuagem existente e utiliza contraste, direção de luz, massas e elementos de apoio para integrar ou transformar a área com segurança visual, buscando um resultado final coeso e intencional.",
  },
] as const;

export const DEFAULT_TERMS_PRESETS = [
  {
    name: "Condições padrão",
    content: "Orçamento válido por 15 dias. O agendamento é confirmado mediante sinal. Alterações significativas no projeto, tamanho ou região podem exigir revisão de prazo e valor.",
  },
  {
    name: "Projeto de uma sessão",
    content: "O valor considera a execução do projeto descrito em uma sessão, respeitando o tamanho e a região informados. Caso seja necessária sessão complementar por alteração de escopo, o novo atendimento será combinado previamente.",
  },
  {
    name: "Múltiplas sessões",
    content: "O projeto foi estimado para múltiplas sessões. O cronograma poderá ser ajustado conforme evolução do trabalho, resposta da pele e eventuais alterações solicitadas durante o desenvolvimento.",
  },
  {
    name: "Projeto autoral premium",
    content: "A reserva contempla desenvolvimento autoral e preparação específica do projeto. Mudanças estruturais após a aprovação da direção artística poderão gerar nova etapa de criação e atualização do orçamento.",
  },
] as const;

export function buildEmptyQuoteEditorData(): QuoteEditorData {
  return {
    project: {
      title: "Projeto de tatuagem",
      style: "",
      bodyRegion: "",
      sizeText: "",
      durationText: "",
      sessions: 1,
      concept: DEFAULT_CONCEPT_PRESETS[0].content,
    },
    media: {
      clientReference: null,
      suggestedArtwork: null,
      coverSource: "reference",
    },
    pricing: {
      mainLabel: "Projeto e execução",
      totalAmount: 0,
      depositAmount: 0,
      showDeposit: true,
      installmentText: "",
    },
    terms: DEFAULT_TERMS_PRESETS[0].content,
    logoSource: "studio",
    watermarkOpacity: 70,
  };
}

export function parseQuotePayload(raw?: string | null): QuoteStoredPayload | null {
  if (!raw) return null;
  try {
    const parsed = quoteStoredPayloadSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
