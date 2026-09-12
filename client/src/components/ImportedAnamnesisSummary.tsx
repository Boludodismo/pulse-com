import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { summarizeAnamnesis, type ImportedSource } from "@/lib/importedAnamnesis";

export default function ImportedAnamnesisSummary({ sources }: { sources: ImportedSource[] }) {
  const forms = sources.map(summarizeAnamnesis).filter(form => form !== null);
  if (!forms.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tatuagens informadas nas anamneses</CardTitle>
        <CardDescription>
          {forms.length} ficha(s) preenchida(s). Cada valor corresponde à resposta da respectiva ficha.
          A planilha registra o preenchimento e o envio do formulário. A data de realização da sessão precisa ser confirmada.
          Os valores informados não comprovam pagamento e podem se repetir em fichas do mesmo trabalho.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {forms.map((form, index) => (
          <article key={`${form.key}-${index}`} className="rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold">Ficha {form.key} · linha {form.row}</h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div><dt className="text-sm text-muted-foreground">Valor da tatuagem informado</dt><dd className="font-semibold whitespace-pre-wrap break-words">{form.amount}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Data da sessão / procedimento</dt><dd>A confirmar</dd></div>
              <div><dt className="text-sm text-muted-foreground">Data de preenchimento declarada</dt><dd>{form.filledDate}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Envio do formulário</dt><dd>{form.submitted}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Profissional informado</dt><dd className="whitespace-pre-wrap break-words">{form.artist}</dd></div>
              <div><dt className="text-sm text-muted-foreground">Arte e local do corpo informados</dt><dd className="whitespace-pre-wrap break-words">{form.description}</dd></div>
            </dl>
            {form.amountWarning && <p className="text-sm text-amber-700 dark:text-amber-300">{form.amountWarning}</p>}
            {form.dateWarning && <p className="text-sm text-amber-700 dark:text-amber-300">{form.dateWarning}</p>}
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
