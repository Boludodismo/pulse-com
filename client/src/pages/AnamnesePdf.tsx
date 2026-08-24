import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

export default function AnamnesePdf() {
  const params = useParams<{ id: string }>();
  const anamneseId = parseInt(params.id || "0");

  const { data: anamnese, isLoading } = trpc.anamnesis.getById.useQuery({ id: anamneseId });

  useEffect(() => {
    if (anamnese) {
      // Aguardar renderização completa antes de imprimir
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [anamnese]);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!anamnese) {
    return (
      <div className="container mx-auto py-8">
        <p className="text-center text-muted-foreground">Ficha de anamnese não encontrada</p>
      </div>
    );
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="print-container" style={{ 
      maxWidth: '210mm',
      margin: '0 auto',
      padding: '20mm',
      fontFamily: 'Arial, sans-serif',
      fontSize: '12pt',
      lineHeight: '1.6'
    }}>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print-container {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
          }
        }
      `}</style>

      <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #333', paddingBottom: '20px' }}>
        <h1 style={{ fontSize: '24pt', fontWeight: 'bold', margin: '0 0 10px 0' }}>
          Ficha de Anamnese
        </h1>
        <p style={{ fontSize: '10pt', color: '#666', margin: 0 }}>
          Preenchida em {formatDate(anamnese.createdAt)}
        </p>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '16pt', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px solid #999', paddingBottom: '5px' }}>
          Informações de Saúde
        </h2>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px', fontWeight: 'bold', width: '40%' }}>Possui alergias?</td>
              <td style={{ padding: '10px' }}>{anamnese.hasAllergies ? "Sim" : "Não"}</td>
            </tr>
            {anamnese.hasAllergies && anamnese.allergiesDetails && (
              <tr style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f9f9f9' }}>
                <td style={{ padding: '10px', paddingLeft: '30px', fontWeight: 'normal', fontStyle: 'italic' }}>Detalhes:</td>
                <td style={{ padding: '10px' }}>{anamnese.allergiesDetails}</td>
              </tr>
            )}

            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px', fontWeight: 'bold' }}>Possui doenças ou condições médicas?</td>
              <td style={{ padding: '10px' }}>{anamnese.hasDiseases ? "Sim" : "Não"}</td>
            </tr>
            {anamnese.hasDiseases && anamnese.diseasesDetails && (
              <tr style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f9f9f9' }}>
                <td style={{ padding: '10px', paddingLeft: '30px', fontWeight: 'normal', fontStyle: 'italic' }}>Detalhes:</td>
                <td style={{ padding: '10px' }}>{anamnese.diseasesDetails}</td>
              </tr>
            )}

            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px', fontWeight: 'bold' }}>Faz uso de medicamentos?</td>
              <td style={{ padding: '10px' }}>{anamnese.usesMedication ? "Sim" : "Não"}</td>
            </tr>
            {anamnese.usesMedication && anamnese.medicationDetails && (
              <tr style={{ borderBottom: '1px solid #ddd', backgroundColor: '#f9f9f9' }}>
                <td style={{ padding: '10px', paddingLeft: '30px', fontWeight: 'normal', fontStyle: 'italic' }}>Detalhes:</td>
                <td style={{ padding: '10px' }}>{anamnese.medicationDetails}</td>
              </tr>
            )}

            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px', fontWeight: 'bold' }}>Está grávida?</td>
              <td style={{ padding: '10px' }}>{anamnese.isPregnant ? "Sim" : "Não"}</td>
            </tr>

            <tr style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px', fontWeight: 'bold' }}>Possui tendência a quelóide?</td>
              <td style={{ padding: '10px' }}>{anamnese.hasKeloid ? "Sim" : "Não"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #999', fontSize: '10pt', color: '#666' }}>
        <p style={{ margin: '5px 0' }}>Documento gerado em {formatDate(new Date())}</p>
        <p style={{ margin: '5px 0' }}>
          Esta ficha de anamnese contém informações confidenciais e deve ser tratada com sigilo profissional.
        </p>
      </div>
    </div>
  );
}
