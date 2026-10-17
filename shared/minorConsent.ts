import { z } from "zod";

export const MINOR_CONSENT_VERSION = "2026-10-17.1";
export const MINOR_CONSENT_TERMS = `A tatuagem introduz pigmentos na pele por agulhas e é permanente. A remoção pode ser incompleta, onerosa e deixar marcas. Existem riscos de dor, sangramento, inchaço, alergias imediatas ou tardias, infecção, cicatrizes, queloides e alterações da pigmentação. Falhas de biossegurança podem transmitir doenças. A pele, a cicatrização e o tempo podem alterar tons e detalhes.

O responsável autoriza exclusivamente o procedimento descrito neste documento, no exercício legítimo de sua responsabilidade parental ou representação legal. A identidade, a idade e a filiação ou representação devem ser conferidas pelo profissional. A autorização não dispensa restrições de idade, normas estaduais ou municipais, nem substitui eventual autorização adicional exigível. O profissional deve conferir a admissibilidade do procedimento no local do atendimento.

O menor deve compreender os esclarecimentos e manifestar sua vontade livremente, podendo recusar, pedir pausa ou desistir. A autorização do responsável não autoriza realizar o procedimento contra a vontade do menor. O desenho, a grafia, o tamanho, as cores e a posição precisam ser aprovados previamente por ambos. O profissional pode adiar o atendimento por segurança ou necessidade de avaliação médica.

As informações de saúde devem ser verdadeiras e atualizadas na anamnese. O responsável e o menor receberão orientações de cuidado por escrito. Febre, secreção ou piora de dor, vermelhidão ou inchaço exigem procurar atendimento de saúde e comunicar o profissional. O profissional deverá cumprir as normas sanitárias e usar produtos e materiais regularizados quando exigível.

Este termo não exclui responsabilidades legais, garantias, indenizações ou direitos do consumidor. Materiais efetivamente usados e intercorrências poderão ser acrescentados depois em registro técnico separado, sem alterar o conteúdo assinado. Mudanças na tatuagem autorizada exigem novo consentimento.

O prestador identificado neste termo trata os dados necessários ao atendimento, registro sanitário e exercício regular de direitos, observando a LGPD e o melhor interesse do menor. Documentos, assinaturas, data, endereço IP e informações do dispositivo serão registrados para identificação, integridade e auditoria, com acesso restrito e guarda pelo período necessário às finalidades legais. O titular ou responsável pode exercer os direitos legais junto ao prestador. A publicação de imagens depende de autorização específica e separada.`;

export const templateSchema = z.object({
  studioName: z.string().trim().min(2).max(255),
  address: z.string().trim().min(8).max(600),
  professionalName: z.string().trim().min(3).max(255),
  professionalDocument: z.string().trim().max(60).default(""),
  contact: z.string().trim().min(3).max(200),
  logo: z.string().max(600_000).default(""),
  terms: z.string().trim().min(200).max(14000),
  jurisdiction: z.string().trim().min(3).max(200),
});
export type ConsentTemplate = z.infer<typeof templateSchema>;
export const procedureSchema = z.object({
  description: z.string().trim().min(3).max(1800),
  bodyRegion: z.string().trim().min(2).max(160),
  side: z.enum(["direito", "esquerdo", "ambos", "central"]),
  size: z.string().trim().min(1).max(100),
  colors: z.string().trim().min(2).max(200),
  plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export const personSchema = z.object({
  name: z.string().trim().min(5).max(255),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  documentType: z.enum(["CPF", "CIN", "RG", "passaporte"]),
  documentNumber: z.string().trim().min(4).max(60),
  sex: z.enum(["feminino", "masculino", "intersexo", "outro"]),
  address: z.string().trim().min(8).max(600),
});
export const signatureSchema = z
  .string()
  .max(500_000)
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
export const submissionSchema = z.object({
  minor: personSchema,
  guardian: z.object({
    name: z.string().trim().min(5).max(255),
    documentType: z.enum(["CPF", "CIN", "RG", "passaporte"]),
    documentNumber: z.string().trim().min(4).max(60),
    relationship: z.enum(["mae", "pai", "tutor", "guardiao_judicial"]),
    address: z.string().trim().min(8).max(600),
    phone: z.string().trim().min(8).max(30),
  }),
  signatureMode: z.enum(["simple", "external"]),
  minorSignature: signatureSchema,
  guardianSignature: z.union([signatureSchema, z.literal("")]).default(""),
  consent: z.literal(true),
  assent: z.literal(true),
  authorityDeclaration: z.literal(true),
  privacyAcknowledged: z.literal(true),
});
export type ConsentSubmission = z.infer<typeof submissionSchema>;
export const materialSchema = z.object({
  category: z.enum(["tinta", "cartucho", "diluente", "descartavel", "outro"]),
  name: z.string().trim().min(2).max(255),
  brand: z.string().trim().max(160).default(""),
  lot: z.string().trim().max(120).default(""),
  expiry: z.string().max(40).default(""),
  anvisa: z.string().trim().max(60).default(""),
  quantity: z.string().trim().max(80).default(""),
});
export function validCpf(raw: string): boolean {
  const s = raw.replace(/\D/g, "");
  if (!/^\d{11}$/.test(s) || /^(\d)\1{10}$/.test(s)) return false;
  for (let i = 9; i < 11; i++) {
    let sum = 0;
    for (let j = 0; j < i; j++) sum += Number(s[j]) * (i + 1 - j);
    const v = (sum * 10) % 11;
    if (Number(s[i]) !== (v === 10 ? 0 : v)) return false;
  }
  return true;
}
export function ageAtDate(
  birthDate: string,
  date = new Date().toISOString().slice(0, 10)
) {
  const target = new Date(date + "T12:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(target.getTime()) ||
    target.toISOString().slice(0, 10) !== date
  )
    throw new Error("Data do procedimento inválida.");
  const birth = new Date(birthDate + "T12:00:00Z");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
    !Number.isFinite(birth.getTime()) ||
    birth.toISOString().slice(0, 10) !== birthDate ||
    birthDate > date
  )
    throw new Error("Data de nascimento inválida.");
  const [y, m, d] = birthDate.split("-").map(Number);
  const [yy, mm, dd] = date.split("-").map(Number);
  return yy - y - (mm < m || (mm === m && dd < d) ? 1 : 0);
}
export function validateSubmission(
  input: ConsentSubmission,
  plannedDate: string
) {
  const age = ageAtDate(input.minor.birthDate, plannedDate);
  if (age < 0 || age >= 18)
    throw new Error(
      "Esta autorização se destina a pessoa menor de 18 anos na data do procedimento."
    );
  for (const p of [input.minor, input.guardian])
    if (["CPF", "CIN"].includes(p.documentType) && !validCpf(p.documentNumber))
      throw new Error(
        "Confira o CPF/CIN do menor e do responsável: dígitos inválidos."
      );
  if (input.signatureMode === "simple" && !input.guardianSignature)
    throw new Error("Falta a assinatura do responsável.");
  return age;
}
export const FILE_KINDS = [
  "minor_document",
  "minor_document_back",
  "guardian_document",
  "guardian_document_back",
  "authority_document",
  "signed_pdf",
  "validation_report",
] as const;
export const statusLabel: Record<string, string> = {
  pending: "Aguardando preenchimento",
  received: "Recebida para conferência",
  approved: "Conferida pelo profissional",
  rejected: "Pendência informada pelo profissional",
  cancelled: "Link cancelado",
};
