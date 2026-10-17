import { jsPDF } from "jspdf";
import type {
  ConsentSubmission,
  ConsentTemplate,
} from "../../shared/minorConsent";
import { MINOR_CONSENT_VERSION } from "../../shared/minorConsent";

export function consentPdf(input: {
  id: number;
  template: ConsentTemplate;
  procedure: any;
  submission: ConsentSubmission;
  hash: string;
  submittedAt?: string;
}) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  let y = 22;
  let textWidth = input.template.logo ? 143 : 174;
  const write = (s: string, size = 10, bold = false) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(s, textWidth) as string[];
    for (const line of lines) {
      if (y > 272) {
        pdf.addPage();
        y = 22;
      }
      pdf.text(line, 18, y);
      y += size * 0.46;
    }
    y += 2.5;
  };
  const { template: t, submission: s, procedure: p } = input;
  if (t.logo) {
    pdf.addImage(t.logo, "PNG", 169, 14, 23, 18, undefined, "FAST");
  }
  write(t.studioName, 14, true);
  write(t.address, 9);
  write(
    `Profissional: ${t.professionalName}${t.professionalDocument ? ` | Documento: ${t.professionalDocument}` : ""}`,
    9
  );
  write(`Contato: ${t.contact}`, 9);
  textWidth = 174;
  y += 3;
  write("AUTORIZACAO DE TATUAGEM PARA MENOR", 14, true);
  write(
    `Registro ${input.id} | Modelo ${MINOR_CONSENT_VERSION} | Local: ${t.jurisdiction}`,
    8.5
  );
  write("Identificacao do menor", 11, true);
  write(
    `${s.minor.name} | Nascimento: ${s.minor.birthDate.split("-").reverse().join("/")} | ${s.minor.documentType}: ${s.minor.documentNumber} | Sexo: ${s.minor.sex}`
  );
  write(`Endereco: ${s.minor.address}`);
  write("Responsavel legal", 11, true);
  write(
    `${s.guardian.name} | Vinculo: ${s.guardian.relationship} | ${s.guardian.documentType}: ${s.guardian.documentNumber}`
  );
  write(`Endereco: ${s.guardian.address} | Contato: ${s.guardian.phone}`);
  write("Procedimento autorizado", 11, true);
  write(
    `${p.description}\nRegiao: ${p.bodyRegion} | Lado: ${p.side} | Tamanho: ${p.size}\nCores: ${p.colors} | Data prevista: ${p.plannedDate.split("-").reverse().join("/")}`
  );
  write("Consentimento informado", 11, true);
  for (const paragraph of t.terms.split(/\n\s*\n/)) write(paragraph);
  write("Confirmacao das vontades", 11, true);
  write(
    "O responsavel declara exercer legitimamente a responsabilidade indicada, ter compreendido os riscos e esclarecimentos e autorizar o procedimento descrito, observadas as exigencias legais aplicaveis. O menor manifesta seu assentimento livre. Ambos confirmam os dados e o recebimento dos esclarecimentos."
  );
  if (y > 220) {
    pdf.addPage();
    y = 22;
  }
  const signature = (data: string, name: string, label: string) => {
    if (y > 228) {
      pdf.addPage();
      y = 22;
    }
    if (data) pdf.addImage(data, "PNG", 22, y, 70, 22, undefined, "FAST");
    y += 24;
    pdf.setDrawColor(130);
    pdf.line(18, y, 185, y);
    y += 5;
    write(`${name} - ${label}`, 9);
    y += 4;
  };
  signature(
    s.minorSignature,
    s.minor.name,
    "assentimento eletronico simples do menor"
  );
  if (s.signatureMode === "simple")
    signature(
      s.guardianSignature,
      s.guardian.name,
      "assinatura eletronica simples do responsavel"
    );
  else {
    write(
      "Responsavel: assinar este PDF externamente com gov.br ou certificado ICP-Brasil e devolver o arquivo original assinado. A verificacao das assinaturas e do conteudo sera registrada separadamente pelo profissional.",
      9
    );
  }
  write(`Registro de integridade dos dados: SHA-256 ${input.hash}`, 8);
  write(
    input.submittedAt
      ? `Recebido em: ${input.submittedAt}`
      : "Documento preparado para assinatura; o recebimento sera registrado no sistema.",
    8
  );
  write(
    "Referencias gerais: ECA, arts. 5, 17 e 18; Codigo Civil, arts. 3, 4 e 1.634; CDC; LGPD; MP 2.200-2/2001, art. 10. Em Minas Gerais: Lei 13.317/1999 e Resolucao SES/MG 8.115/2022, art. 54. Conferir as normas do estado e municipio do atendimento. As referencias nao constituem permissao automatica para tatuar menores.",
    8
  );
  const count = pdf.getNumberOfPages();
  for (let n = 1; n <= count; n++) {
    pdf.setPage(n);
    pdf.setFontSize(8);
    pdf.setTextColor(90);
    pdf.text(`Tatuei | Autorizacao ${input.id} | ${n}/${count}`, 18, 287);
  }
  return Buffer.from(pdf.output("arraybuffer"));
}
