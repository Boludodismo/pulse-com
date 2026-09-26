import { z } from "zod";

export const QUOTE_TEXT_LIMIT = 8000;
export const QUOTE_IMAGE_LIMIT = 40;

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
  protect: z.boolean().default(false),
  kind: z.enum(["reference", "current", "artwork", "detail"]).default("reference"),
}).strict();

export type QuoteMedia = z.infer<typeof quoteMediaSchema>;

export const quoteProjectSchema = z.object({
    title: z.string().trim().max(160).default("Projeto de tatuagem"),
    style: z.string().trim().max(120).default(""),
    bodyRegion: z.string().trim().max(120).default(""),
    sizeText: z.string().trim().max(120).default(""),
    durationText: z.string().trim().max(120).default(""),
    sessions: z.number().int().min(1).max(30).default(1),
    concept: z.string().trim().max(QUOTE_TEXT_LIMIT).default(""),
  }).strict();

export const quoteEditorDataSchema = z.object({
  project: quoteProjectSchema,
  media: z.object({
    clientReference: quoteMediaSchema.nullable().default(null),
    suggestedArtwork: quoteMediaSchema.nullable().default(null),
    coverSource: z.enum(["reference", "suggested"]).default("reference"),
    gallery: z.array(quoteMediaSchema).max(QUOTE_IMAGE_LIMIT).default([]),
  }).strict(),
  additionalProjects: z.array(z.object({
    id: z.string().min(1).max(80),
    project: quoteProjectSchema,
    images: z.array(quoteMediaSchema).max(QUOTE_IMAGE_LIMIT).default([]),
  }).strict()).max(19).default([]),
  pricing: z.object({
    mainLabel: z.string().trim().max(120).default("Projeto e execução"),
    totalAmount: z.number().int().min(0).max(100_000_000).default(0),
    depositAmount: z.number().int().min(0).max(100_000_000).default(0),
    showDeposit: z.boolean().default(true),
    installmentText: z.string().trim().max(120).default(""),
    depositText: z.string().trim().max(QUOTE_TEXT_LIMIT).default(""),
    installmentInfo: z.string().trim().max(QUOTE_TEXT_LIMIT).default(""),
    showDepositText: z.boolean().default(true),
    showInstallmentInfo: z.boolean().default(true),
  }).strict(),
  terms: z.string().trim().max(QUOTE_TEXT_LIMIT).default(""),
  contactSource: z.enum(["studio", "artist"]).default("studio"),
  logoSource: z.enum(["personal", "studio", "none"]).default("studio"),
  watermarkOpacity: z.number().int().min(20).max(100).default(70),
}).strict().superRefine((editor, ctx) => {
  if (allQuoteMedia(editor).length > QUOTE_IMAGE_LIMIT) {
    ctx.addIssue({ code: "custom", message: `O orçamento aceita até ${QUOTE_IMAGE_LIMIT} imagens.`, path: ["media"] });
  }
  if (new Set(editor.additionalProjects.map(p => p.id)).size !== editor.additionalProjects.length) {
    ctx.addIssue({ code: "custom", message: "Identificação de projeto repetida.", path: ["additionalProjects"] });
  }
});

export type QuoteEditorData = z.infer<typeof quoteEditorDataSchema>;

export function allQuoteMedia(editor: QuoteEditorData): QuoteMedia[] {
  return [editor.media.clientReference, editor.media.suggestedArtwork,
    ...editor.media.gallery, ...editor.additionalProjects.flatMap(p => p.images)]
    .filter((image): image is QuoteMedia => Boolean(image));
}

export function mapQuoteMedia(editor: QuoteEditorData, map: (image: QuoteMedia) => QuoteMedia): QuoteEditorData {
  return { ...editor, media: { ...editor.media,
    clientReference: editor.media.clientReference && map(editor.media.clientReference),
    suggestedArtwork: editor.media.suggestedArtwork && map(editor.media.suggestedArtwork),
    gallery: editor.media.gallery.map(map),
  }, additionalProjects: editor.additionalProjects.map(p => ({ ...p, images: p.images.map(map) })) };
}

const nullableShort = z.string().max(500).nullable();

export const quoteStoredPayloadSchema = z.object({
  version: z.literal(1),
  editor: quoteEditorDataSchema,
  protectedMedia: z.array(z.object({
    sourceKey: z.string().min(1).max(500),
    media: quoteMediaSchema,
  }).strict()).max(QUOTE_IMAGE_LIMIT).default([]),
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

export const QUOTE_PRESET_CATEGORIES = ["concept", "terms", "bio", "payment", "notes", "deposit", "installment"] as const;
export type QuotePresetCategory = (typeof QUOTE_PRESET_CATEGORIES)[number];

export const DEFAULT_CONCEPT_PRESETS = [
  {
    "name": "Realismo preto e cinza",
    "content": "Projeto em realismo preto e cinza, desenvolvido a partir das referências escolhidas. A composição dará atenção aos volumes, à luz e ao contraste, com adaptação ao formato da região do corpo. Os detalhes e a dimensão final serão alinhados antes da execução."
  },
  {
    "name": "Realismo colorido",
    "content": "Projeto em realismo colorido, com paleta e composição definidas a partir das referências. A distribuição das cores, os pontos de luz e o contraste serão planejados para a região escolhida. A proposta visual e os ajustes de tamanho serão apresentados para alinhamento antes da execução."
  },
  {
    "name": "Retrato ou homenagem",
    "content": "Tatuagem de retrato ou homenagem, baseada nas fotografias e referências fornecidas. O projeto buscará preservar a expressão e as características mais importantes da imagem. A escolha da foto, a nitidez disponível e o tamanho serão avaliados juntos para definir os detalhes viáveis."
  },
  {
    "name": "Fine line, botânica ou escrita",
    "content": "Projeto delicado em linhas finas, com desenho, elementos botânicos ou escrita conforme a proposta escolhida. O espaçamento e a espessura dos traços serão adaptados ao tamanho e à região do corpo. Quando houver palavras, nomes ou datas, a grafia será conferida com o cliente antes da aplicação."
  },
  {
    "name": "Cobertura de tatuagem",
    "content": "Projeto de cobertura desenvolvido a partir da avaliação da tatuagem existente. O novo desenho considerará o tamanho, a posição e a intensidade dos pigmentos atuais, podendo exigir ampliação da área ou ajustes de composição e contraste. A viabilidade e as limitações serão alinhadas antes da execução; a referência visual representa a proposta e não uma garantia de ocultação integral."
  },
  {
    "name": "Reforma e complementação",
    "content": "Projeto de reforma ou complementação de uma tatuagem existente. O trabalho poderá incluir reforço de contraste, revisão de detalhes e inclusão de elementos, conforme a avaliação e o escopo descrito neste orçamento. As partes preservadas e as alterações propostas serão definidas com o cliente antes da execução."
  },
  {
    "name": "Fechamento ou projeto em etapas",
    "content": "Projeto de fechamento planejado para integrar os elementos e acompanhar a anatomia da região escolhida. A composição poderá ser executada em etapas, com uma sequência de trabalho apresentada pelo artista. A previsão de sessões e o que está incluído em cada etapa serão descritos nas condições deste orçamento."
  },
  {
    "name": "Vários projetos no mesmo orçamento",
    "content": "Esta proposta reúne diferentes tatuagens, apresentadas separadamente com suas descrições e referências. Os valores, as condições e os itens incluídos serão identificados no orçamento. A ordem de execução e a possibilidade de realizar os projetos na mesma sessão serão alinhadas com o artista."
  }
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
  return quoteEditorDataSchema.parse({
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
  });
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

export const DEFAULT_DEPOSIT_PRESETS = [
  {
    "name": "Reserva da data",
    "content": "O sinal confirma a reserva da data combinada e é abatido do valor total da tatuagem. O restante será pago conforme as condições deste orçamento."
  },
  {
    "name": "Planejamento do projeto",
    "content": "O sinal permite iniciar o planejamento do seu projeto e reservar o período de atendimento combinado. Esse valor faz parte do total da tatuagem e será descontado do saldo a pagar."
  },
  {
    "name": "Organização da agenda",
    "content": "O sinal confirma seu compromisso com o projeto e permite organizar a agenda e a preparação do atendimento. Após a confirmação do pagamento, o horário combinado fica reservado. O valor será abatido do total da tatuagem."
  }
] as const;

export const DEFAULT_INSTALLMENT_PRESETS = [
  {
    "name": "Direto e objetivo",
    "content": "No parcelamento pelo cartão de crédito, as taxas da maquininha são repassadas ao cliente. O total e o valor de cada parcela serão informados antes da confirmação do pagamento."
  },
  {
    "name": "Escolha das parcelas",
    "content": "Você pode parcelar no cartão de crédito com acréscimo das taxas da maquininha. Como a taxa varia conforme o número de parcelas, apresentaremos os valores para você escolher a opção de pagamento."
  },
  {
    "name": "Valor base e valor parcelado",
    "content": "O valor base da tatuagem não inclui as taxas do parcelamento no cartão. Ao escolher essa modalidade, as taxas da maquininha serão acrescentadas. O total e as parcelas serão apresentados para sua aprovação antes da cobrança."
  }
] as const;
