import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, HeartPulse, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const DEFAULT_SOURCE_ARTISTS = ["Willian Cunha", "Willian"];

export function LegacyAnamnesisImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [selectedArtists, setSelectedArtists] = useState(DEFAULT_SOURCE_ARTISTS);
  const [targetArtistId, setTargetArtistId] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const artistsQuery = trpc.artists.list.useQuery();
  const batchesQuery = trpc.legacyAnamnesis.batches.useQuery();
  const preview = trpc.legacyAnamnesis.preview.useMutation({ onError: (error) => toast.error(error.message) });
  const importer = trpc.legacyAnamnesis.import.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.importedRows} fichas importadas com segurança.`);
      batchesQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (targetArtistId || !artistsQuery.data?.length) return;
    const willian = artistsQuery.data.find((artist) => artist.active && /willian/i.test(artist.name));
    setTargetArtistId((willian ?? artistsQuery.data.find((artist) => artist.active) ?? artistsQuery.data[0]).id);
  }, [artistsQuery.data, targetArtistId]);

  async function chooseFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) return toast.error("Selecione o arquivo CSV exportado do Google Forms.");
    if (file.size > 15_000_000) return toast.error("O arquivo excede o limite de 15 MB.");
    const text = await file.text();
    setFileName(file.name);
    setContent(text);
    setConfirmed(false);
    preview.mutate({ content: text, selectedArtists });
  }

  function toggleArtist(name: string) {
    setSelectedArtists((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
    setConfirmed(false);
  }

  const data = preview.data;
  const result = importer.data;

  return (
    <div className="space-y-4">
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          Importação específica para o histórico do Google Forms. Ela preserva todas as fichas, reúne registros repetidos no mesmo cliente e cria somente o lembrete anual de pós-venda. <strong>Não cria agendamentos nem movimentações financeiras.</strong>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><FileUp className="h-5 w-5" />1. Selecionar o CSV histórico</CardTitle>
          <CardDescription>O arquivo é enviado diretamente ao CRM e não é incluído no GitHub.</CardDescription>
        </CardHeader>
        <CardContent>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => chooseFile(event.target.files?.[0])} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4 mr-2" />{fileName || "Escolher arquivo CSV"}</Button>
        </CardContent>
      </Card>

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-5 w-5" />2. Conferir origem e destino</CardTitle>
              <CardDescription>Somente os artistas marcados na coluna original serão importados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-muted/40 p-3"><p className="text-2xl font-bold">{data.selectedRows}</p><p className="text-xs text-muted-foreground">fichas selecionadas</p></div>
                <div className="rounded-lg bg-muted/40 p-3"><p className="text-2xl font-bold">{data.estimatedUniqueClients}</p><p className="text-xs text-muted-foreground">clientes únicos estimados</p></div>
                <div className="rounded-lg bg-muted/40 p-3"><p className="text-2xl font-bold">{data.excludedRows}</p><p className="text-xs text-muted-foreground">fichas excluídas</p></div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Nomes de artista encontrados no CSV</p>
                <div className="flex flex-wrap gap-2">
                  {data.sourceArtists.map((artist) => (
                    <label key={artist.name} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={selectedArtists.includes(artist.name)} onChange={() => toggleArtist(artist.name)} />
                      {artist.name} <Badge variant="secondary">{artist.count}</Badge>
                    </label>
                  ))}
                </div>
                <Button className="mt-2" size="sm" variant="outline" disabled={!selectedArtists.length || preview.isPending} onClick={() => preview.mutate({ content, selectedArtists })}>
                  {preview.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}Atualizar análise
                </Button>
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="targetArtist">Vincular todos ao artista cadastrado</label>
                <select id="targetArtist" className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" value={targetArtistId ?? ""} onChange={(event) => setTargetArtistId(Number(event.target.value))}>
                  {artistsQuery.data?.filter((artist) => artist.active).map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><HeartPulse className="h-5 w-5" />3. Revisar saúde, datas e consentimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["low", "medium", "high", "critical"] as const).map((risk) => (
                  <div key={risk} className="rounded-md border p-2 text-center"><p className="font-bold">{data.riskCounts[risk]}</p><p className="text-xs text-muted-foreground">{risk === "low" ? "baixo" : risk === "medium" ? "médio" : risk === "high" ? "alto" : "crítico"}</p></div>
                ))}
              </div>
              {data.warnings.map((warning) => <Alert key={warning} variant={warning.includes("sem aceite") ? "destructive" : "default"}><AlertTriangle className="h-4 w-4" /><AlertDescription>{warning}</AlertDescription></Alert>)}
              <label className="flex items-start gap-2 text-sm rounded-md border p-3">
                <input type="checkbox" className="mt-1" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
                <span>Revisei os números, confirmo que “Willian” e “Willian Cunha” representam o artista escolhido e autorizo a inclusão destes dados históricos no CRM.</span>
              </label>
              <Button disabled={!confirmed || !targetArtistId || importer.isPending || data.selectedRows === 0} onClick={() => targetArtistId && importer.mutate({ content, fileName, selectedArtists, targetArtistId })}>
                {importer.isPending ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}Importar fichas e criar pós-venda anual
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {result && (
        <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>
          Importação concluída: <strong>{result.importedRows} fichas</strong>, {result.createdClients} clientes novos, {result.updatedClients} clientes complementados, {result.skippedRows} ignoradas e {result.errorRows} pendências.
        </AlertDescription></Alert>
      )}

      {!!batchesQuery.data?.length && (
        <Card><CardHeader><CardTitle className="text-base">Histórico de importações</CardTitle></CardHeader><CardContent className="space-y-2">
          {batchesQuery.data.slice().reverse().map((batch) => <div key={batch.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"><span>{batch.fileName}</span><span>{batch.importedRows} importadas · {batch.createdClients} clientes novos</span><Badge variant={batch.status === "completed" ? "default" : "destructive"}>{batch.status === "completed" ? "Concluída" : batch.status}</Badge></div>)}
        </CardContent></Card>
      )}
    </div>
  );
}
