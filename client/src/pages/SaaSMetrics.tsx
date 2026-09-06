import { Building2, Clock3, Mail, ShieldCheck, UserCheck, UsersRound } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function MetricCard({ title, value, description, icon: Icon }: { title: string; value: number; description: string; icon: typeof UsersRound }) {
  return <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-4 w-4 text-primary" /></CardHeader><CardContent><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></CardContent></Card>;
}

export default function SaaSMetrics() {
  const auth = trpc.auth.me.useQuery();
  const isSuperadmin = auth.data?.role === "superadmin";
  const metrics = trpc.saas.metrics.useQuery(undefined, { enabled: isSuperadmin });

  if (auth.isLoading || metrics.isLoading) return <div className="container max-w-6xl space-y-6 py-6"><Skeleton className="h-9 w-64" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32" />)}</div></div>;
  if (!isSuperadmin) return <div className="container max-w-6xl py-6"><Card><CardContent className="p-6"><p className="font-medium">Acesso restrito ao Superadministrador.</p><p className="mt-1 text-sm text-muted-foreground">As métricas consolidadas do SaaS não ficam disponíveis para empresas convidadas.</p></CardContent></Card></div>;
  if (metrics.isError || !metrics.data) return <div className="container max-w-6xl py-6"><Card><CardContent className="p-6"><p className="font-medium">Não foi possível carregar as métricas SaaS.</p><p className="mt-1 text-sm text-muted-foreground">{metrics.error?.message || "Tente atualizar a página."}</p></CardContent></Card></div>;

  const data = metrics.data;
  return <div className="container max-w-6xl space-y-6 py-4 sm:py-6">
    <header><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h1 className="text-2xl font-semibold">Métricas SaaS</h1></div><p className="mt-1 text-sm text-muted-foreground">Visão consolidada das empresas de teste, acessos e convites.</p></header>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard title="Empresas ativas" value={data.activeStudios} description={`${data.totalStudios} empresa(s) cadastrada(s)`} icon={Building2} />
      <MetricCard title="Usuários ativos" value={data.activeUsers} description={`${data.administrators} administrador(es) e ${data.collaborators} colaborador(es)`} icon={UsersRound} />
      <MetricCard title="Acessos em teste" value={data.activeTrialAccesses} description="Vínculos temporários ainda ativos" icon={UserCheck} />
      <MetricCard title="Expiram em breve" value={data.accessExpiringSoon} description="Acessos que vencem nos próximos 7 dias" icon={Clock3} />
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />Convites</CardTitle><CardDescription>Acompanhamento do ciclo de convites temporários.</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4"><div><p className="text-2xl font-semibold">{data.invitations.pending}</p><p className="text-xs text-muted-foreground">Pendentes</p></div><div><p className="text-2xl font-semibold">{data.invitations.accepted}</p><p className="text-xs text-muted-foreground">Aceitos</p></div><div><p className="text-2xl font-semibold">{data.invitations.revoked}</p><p className="text-xs text-muted-foreground">Revogados</p></div><div><p className="text-2xl font-semibold">{data.invitations.expired}</p><p className="text-xs text-muted-foreground">Expirados</p></div></CardContent></Card>
      <Card><CardHeader><CardTitle>Assinaturas e cobrança</CardTitle><CardDescription>Estado atual do MVP SaaS.</CardDescription></CardHeader><CardContent><p className="font-medium">Cobrança ainda não habilitada</p><p className="mt-1 text-sm text-muted-foreground">Nesta fase, o sistema registra acessos de teste temporários em vez de assinaturas pagas. Os indicadores acima não representam receita, planos ou pagamentos.</p></CardContent></Card>
    </div>
  </div>;
}
