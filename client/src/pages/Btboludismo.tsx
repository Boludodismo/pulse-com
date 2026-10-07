import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink } from "lucide-react";

const BTBOLUDISMO_URL = "https://btboludismo.williancunha.chatgpt.site";

export default function Btboludismo() {
  const { user, loading } = useAuth();
  const eligible = !loading && user?.canAccessBtboludismo === true;
  const access = trpc.btboludismo.access.useQuery(undefined, {
    enabled: eligible,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (loading) return <p role="status">Verificando seu acesso ao Btboludismo…</p>;
  if (!eligible) return <p role="alert">O Btboludismo está disponível somente para a conta autorizada.</p>;
  if (access.isLoading) return <p role="status">Verificando seu acesso ao Btboludismo…</p>;
  if (access.error || access.data?.url !== BTBOLUDISMO_URL) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">Btboludismo</h1>
        <p role="alert">Não foi possível confirmar o acesso ao piloto privado.</p>
        <Button variant="outline" onClick={() => access.refetch()}>Tentar novamente</Button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Btboludismo</h1>
        <p className="text-muted-foreground">Acesso ao piloto privado.</p>
      </header>
      <Card>
        <CardHeader><CardTitle>Abrir o ambiente de teste</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p>O Btboludismo será aberto em outra aba. O CRM continua disponível nesta aba.</p>
          <Button asChild>
            <a href={BTBOLUDISMO_URL} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              Abrir Btboludismo em nova aba
            </a>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}
