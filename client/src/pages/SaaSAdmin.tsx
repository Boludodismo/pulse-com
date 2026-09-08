import {INBOX_MODULE_LABELS} from '../../../shared/intelligentInbox';
import { useMemo, useState } from "react";
import { Copy, Link2, ShieldCheck, UserPlus, Ban, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

export const moduleLabels = {
  clients: "Clientes",
  appointments: "Agenda",
  stock: "Estoque",
  finance: "Financeiro",
  anamnesis: "Anamnese",
  pod: "POD",
  reports: "Relatórios",
  ...INBOX_MODULE_LABELS,
} as const;

export const roleLabels = {
  admin: "Administrador",
  collaborator: "Colaborador",
  user: "Usuário",
} as const;

export const invitationStatusLabels = {
  pending: "Pendente",
  accepted: "Aceito",
  revoked: "Revogado",
  expired: "Expirado",
} as const;

export const accessStatusLabels = {
  active: "Ativo",
  suspended: "Suspenso",
  revoked: "Revogado",
} as const;

export default function SaaSAdmin() {
  const auth = trpc.auth.me.useQuery();
  const user = auth.data;
  const isSuperadmin = user?.role === "superadmin";
  const isAdmin = user?.role === "admin";
  const canManage = isSuperadmin || isAdmin;
  const studios = trpc.saas.studios.useQuery(undefined, { enabled: isSuperadmin });
  const invitations = trpc.saas.listStudioInvitations.useQuery(undefined, { enabled: canManage });
  const teamAccess = trpc.saas.teamAccess.useQuery(undefined, { enabled: canManage });
  const utils = trpc.useUtils();
  const createInvitation = trpc.saas.createInvitation.useMutation({
    onSuccess: async ({ token, expiresAt }) => {
      const link = `${window.location.origin}/convite/${token}`;
      setGeneratedLink(link);
      await navigator.clipboard?.writeText(link);
      toast.success(`Convite criado e link copiado. Expira em ${new Date(expiresAt).toLocaleDateString("pt-BR")}.`);
      await utils.saas.listStudioInvitations.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const setPermissions = trpc.saas.setPermissions.useMutation({
    onSuccess: async () => { await utils.saas.teamAccess.invalidate(); toast.success("Permissões atualizadas."); },
    onError: (error) => toast.error(error.message),
  });
  const revokeInvitation = trpc.saas.revokeInvitation.useMutation({
    onSuccess: async () => {
      toast.success("Convite revogado.");
      await utils.saas.listStudioInvitations.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "collaborator">(isAdmin ? "collaborator" : "admin");
  const [studioId, setStudioId] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");

  const selectedStudio = useMemo(() => studios.data?.find((studio) => String(studio.id) === studioId), [studios.data, studioId]);
  const togglePermission = (member: NonNullable<typeof teamAccess.data>[number], module: keyof typeof moduleLabels, field: "canRead" | "canWrite", checked: boolean) => {
    const current = member.permissions.map((permission) => ({ module: permission.module as keyof typeof moduleLabels, canRead: Boolean(permission.canRead), canWrite: Boolean(permission.canWrite) }));
    const existing = current.find((permission) => permission.module === module);
    if (existing) existing[field] = checked;
    else current.push({ module, canRead: field === "canRead" ? checked : false, canWrite: field === "canWrite" ? checked : false });
    setPermissions.mutate({ userId: member.id, permissions: current });
  };

  if (auth.isLoading) return <div className="container py-6"><p className="text-muted-foreground">Carregando permissões…</p></div>;
  if (!canManage) return <div className="container py-6"><Card><CardContent className="p-6"><p>Acesso restrito a administradores.</p></CardContent></Card></div>;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSuperadmin && !studioId) return toast.error("Selecione a empresa.");
    createInvitation.mutate({ email: email.trim(), role, studioId: isSuperadmin ? Number(studioId) : undefined });
  };

  return (
    <div className="container max-w-6xl space-y-6 py-4 sm:py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /><h1 className="text-2xl font-semibold">Gestão SaaS</h1></div>
          <p className="text-sm text-muted-foreground">Convites temporários e acesso isolado por empresa.</p>
        </div>
        <Badge variant="outline">Teste gratuito · 7 dias</Badge>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" />Gerar convite</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              {isSuperadmin ? <div className="space-y-2"><Label>Empresa</Label><Select value={studioId} onValueChange={setStudioId}><SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger><SelectContent>{studios.data?.map((studio) => <SelectItem key={studio.id} value={String(studio.id)}>{studio.name}</SelectItem>)}</SelectContent></Select></div> : <div className="rounded-md border border-border/60 bg-muted/20 p-3 text-sm">Empresa atual: <strong>{user?.studioId ? `#${user.studioId}` : "não vinculada"}</strong></div>}
              <div className="space-y-2"><Label htmlFor="invite-email">E-mail do convidado</Label><Input id="invite-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@empresa.com" /></div>
              <div className="space-y-2"><Label>Perfil</Label><Select value={role} onValueChange={(value: "admin" | "collaborator") => setRole(value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{isSuperadmin && <SelectItem value="admin">Administrador da empresa</SelectItem>}<SelectItem value="collaborator">Colaborador</SelectItem></SelectContent></Select></div>
              <Button className="w-full" type="submit" disabled={createInvitation.isPending}><Link2 className="mr-2 h-4 w-4" />{createInvitation.isPending ? "Gerando…" : "Gerar link copiável"}</Button>
            </form>
            {generatedLink && <div className="mt-4 space-y-2"><Label>Link para enviar pelo WhatsApp</Label><div className="flex gap-2"><Input readOnly value={generatedLink} /><Button type="button" variant="outline" size="icon" onClick={() => { navigator.clipboard?.writeText(generatedLink); toast.success("Link copiado."); }}><Copy className="h-4 w-4" /></Button></div></div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" />Convites emitidos</CardTitle></CardHeader>
          <CardContent><div className="space-y-3">{invitations.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : invitations.data?.length ? invitations.data.map((invitation) => <div key={invitation.id} className="flex flex-col gap-2 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate font-medium">{invitation.email}</p><p className="text-xs text-muted-foreground">{roleLabels[invitation.role as keyof typeof roleLabels] || invitation.role} · expira {new Date(invitation.expiresAt).toLocaleDateString("pt-BR")}</p></div><div className="flex items-center gap-2"><Badge variant={invitation.status === "pending" ? "secondary" : invitation.status === "accepted" ? "default" : "destructive"}>{invitationStatusLabels[invitation.status as keyof typeof invitationStatusLabels] || invitation.status}</Badge>{invitation.status === "pending" && <Button variant="outline" size="sm" onClick={() => revokeInvitation.mutate({ id: invitation.id })} disabled={revokeInvitation.isPending}><Ban className="mr-1 h-3 w-3" />Revogar</Button>}</div></div>) : <p className="text-sm text-muted-foreground">Nenhum convite emitido.</p>}</div></CardContent>
        </Card>
      </div>

      <Card><CardHeader><CardTitle>Equipe e permissões</CardTitle></CardHeader><CardContent><div className="space-y-4">{teamAccess.isLoading ? <p className="text-sm text-muted-foreground">Carregando equipe…</p> : teamAccess.data?.length ? teamAccess.data.map((member) => <div key={member.id} className="rounded-lg border border-border/60 p-3"><div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{member.name || member.email || `Usuário #${member.id}`}</p><p className="text-xs text-muted-foreground">{member.email || "Sem e-mail"} · {roleLabels[member.role as keyof typeof roleLabels] || member.role}</p></div><Badge variant={member.accessStatus === "suspended" ? "destructive" : "secondary"}>{accessStatusLabels[(member.accessStatus || "active") as keyof typeof accessStatusLabels] || member.accessStatus || "Ativo"}</Badge></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{(Object.keys(moduleLabels) as Array<keyof typeof moduleLabels>).map((module) => { const permission = member.permissions.find((item) => item.module === module); return <div key={module} className="rounded-md bg-muted/20 p-2 text-xs"><p className="mb-1 font-medium">{moduleLabels[module]}</p><label className="mr-3 inline-flex items-center gap-1"><input type="checkbox" checked={Boolean(permission?.canRead)} onChange={(event) => togglePermission(member, module, "canRead", event.target.checked)} />Ler</label><label className="inline-flex items-center gap-1"><input type="checkbox" checked={Boolean(permission?.canWrite)} onChange={(event) => togglePermission(member, module, "canWrite", event.target.checked)} />Editar</label></div>; })}</div></div>) : <p className="text-sm text-muted-foreground">Nenhum usuário vinculado a esta empresa.</p>}</div></CardContent></Card>

      <Card><CardHeader><CardTitle>Modelo de acesso do MVP</CardTitle></CardHeader><CardContent><div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><strong>Superadministrador</strong><p className="text-muted-foreground">Acesso global e revogação.</p></div><div><strong>Administrador</strong><p className="text-muted-foreground">Somente a própria empresa.</p></div><div><strong>Colaborador</strong><p className="text-muted-foreground">Módulos autorizados.</p></div><div><strong>Módulos</strong><p className="text-muted-foreground">{Object.values(moduleLabels).join(", ")}.</p></div></div></CardContent></Card>
    </div>
  );
}
