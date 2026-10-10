import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

export default function AccountSecurity() {
  const utils = trpc.useUtils();
  const status = trpc.security.status.useQuery();
  const sessions = trpc.security.sessions.useQuery();
  const [password, setPassword] = useState("");
  const [currentCode, setCurrentCode] = useState("");
  const [currentChallenge, setCurrentChallenge] = useState<string>();
  const [method, setMethod] = useState<"totp" | "email">("totp");
  const [setup, setSetup] = useState<{
    challenge: string;
    secret: string | null;
    method: string;
  }>();
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>();
  const [savedCodes, setSavedCodes] = useState(false);
  const onError = (error: { message: string }) => toast.error(error.message);
  const begin = trpc.security.beginEnrollment.useMutation({
    onSuccess: result => {
      setSetup(result);
      setPassword("");
      setCurrentCode("");
      setCurrentChallenge(undefined);
      setCode("");
    },
    onError,
  });
  const confirm = trpc.security.confirmEnrollment.useMutation({
    onSuccess: result => {
      setRecoveryCodes(result.codes);
      setSavedCodes(false);
      setSetup(undefined);
      setCode("");
      utils.security.status.invalidate();
      utils.security.sessions.invalidate();
      toast.success(
        "Verificação em dois fatores ativada. Guarde os códigos de recuperação."
      );
    },
    onError,
  });
  const send = trpc.security.sendManagementCode.useMutation({
    onSuccess: result => {
      setCurrentChallenge(result.challenge);
      toast.success("Código enviado ao e-mail da sua conta.");
    },
    onError,
  });
  const disable = trpc.security.disable.useMutation({
    onSuccess: () => {
      setPassword("");
      setCurrentCode("");
      setCurrentChallenge(undefined);
      utils.security.status.invalidate();
      utils.security.sessions.invalidate();
      toast.success(
        "Verificação desativada. As sessões anteriores foram encerradas."
      );
    },
    onError,
  });
  const revoke = trpc.security.revokeSession.useMutation({
    onSuccess: () => {
      utils.security.sessions.invalidate();
      toast.success(
        "Sessão encerrada. Se era a sessão atual, entre novamente."
      );
    },
    onError,
  });
  if (status.isLoading)
    return <p className="p-6">Carregando segurança da conta…</p>;
  if (status.error || !status.data)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {status.error?.message || "Não foi possível carregar a segurança."}
        </AlertDescription>
      </Alert>
    );
  const active = status.data.method !== "off";
  const proof = { password, currentCode, currentChallenge };
  const busy =
    begin.isPending || confirm.isPending || disable.isPending || send.isPending;
  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Segurança da minha conta</h1>
        <p className="text-muted-foreground">
          Proteja seu acesso e confira as sessões abertas.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Verificação em dois fatores</CardTitle>
          <CardDescription>
            {active
              ? `Ativa por ${status.data.method === "totp" ? "aplicativo autenticador" : "e-mail"}.`
              : "Ainda não ativada. Sua senha continuará sendo solicitada no login."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.data.superadmin && (
            <Alert>
              <AlertDescription>
                Para superadministradores, use o aplicativo autenticador. Depois
                de ativado, você poderá substituí-lo confirmando o fator atual
                ou usando um código de recuperação.
              </AlertDescription>
            </Alert>
          )}
          {recoveryCodes ? (
            <div className="space-y-4" role="status">
              <p className="font-medium">
                Guarde estes 10 códigos de recuperação agora.
              </p>
              <p className="text-sm text-muted-foreground">
                Cada código funciona uma única vez, caso perca o autenticador ou
                o acesso ao e-mail. Eles não serão exibidos novamente.
              </p>
              <pre className="rounded bg-muted p-4 text-sm overflow-auto select-all">
                {recoveryCodes.join("\n")}
              </pre>
              <Button
                variant="outline"
                onClick={() => {
                  const blob = new Blob(
                    [
                      `Tatuei — códigos de recuperação\nConta: ${status.data!.email}\nCada código é de uso único. Mantenha em local seguro.\n\n${recoveryCodes.join("\n")}`,
                    ],
                    { type: "text/plain" }
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "tatuei-codigos-recuperacao.txt";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Baixar códigos
              </Button>
              <label className="flex gap-2 items-center text-sm">
                <input
                  type="checkbox"
                  checked={savedCodes}
                  onChange={e => setSavedCodes(e.target.checked)}
                />
                Guardei os códigos em um local seguro.
              </label>
              <Button
                disabled={!savedCodes}
                onClick={() => setRecoveryCodes(undefined)}
              >
                Concluir
              </Button>
            </div>
          ) : setup ? (
            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                confirm.mutate({ challenge: setup.challenge, code });
              }}
            >
              {setup.secret ? (
                <>
                  <p>
                    Abra seu aplicativo autenticador, escolha{" "}
                    <strong>
                      Adicionar conta → Inserir chave de configuração
                    </strong>{" "}
                    e selecione códigos baseados em tempo. Nome da conta: Tatuei
                    ({status.data.email}).
                  </p>
                  <Label htmlFor="setup-secret">Chave de configuração</Label>
                  <Input
                    id="setup-secret"
                    value={setup.secret}
                    readOnly
                    className="font-mono"
                  />
                  <p className="text-sm text-muted-foreground">
                    Não compartilhe esta chave. A configuração expira em 5
                    minutos.
                  </p>
                </>
              ) : (
                <p>
                  Enviamos um código para {status.data.email}. Ele expira em 5
                  minutos.
                </p>
              )}
              <Label htmlFor="setup-code">Código de 6 dígitos</Label>
              <Input
                id="setup-code"
                value={code}
                onChange={e =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
              <div className="flex gap-2">
                <Button disabled={busy || code.length !== 6}>
                  Confirmar e ativar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setSetup(undefined);
                    setCode("");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : status.data.local ? (
            <form
              className="space-y-4"
              onSubmit={e => {
                e.preventDefault();
                begin.mutate({ ...proof, method });
              }}
            >
              <Label htmlFor="security-method">Método de verificação</Label>
              <select
                id="security-method"
                value={method}
                onChange={e => setMethod(e.target.value as "totp" | "email")}
                className="w-full rounded-md border bg-background p-2"
                disabled={busy}
              >
                <option value="totp">
                  Aplicativo autenticador (recomendado)
                </option>
                <option value="email" disabled={!status.data.emailAvailable}>
                  E-mail{!status.data.emailAvailable ? " — indisponível" : ""}
                </option>
              </select>
              {!status.data.emailAvailable && !status.data.superadmin && (
                <p className="text-sm text-muted-foreground">
                  O envio de e-mail de segurança ainda precisa ser configurado
                  pelo administrador do sistema.
                </p>
              )}
              <Label htmlFor="security-password">
                Confirme sua senha atual
              </Label>
              <Input
                id="security-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={busy}
              />
              {active && (
                <>
                  <Label htmlFor="current-factor">
                    Código atual ou código de recuperação
                  </Label>
                  <Input
                    id="current-factor"
                    autoComplete="one-time-code"
                    value={currentCode}
                    onChange={e => setCurrentCode(e.target.value)}
                    disabled={busy}
                  />
                  {status.data.method === "email" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => send.mutate(proof)}
                      disabled={busy || !password}
                    >
                      Receber código atual por e-mail
                    </Button>
                  )}
                </>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || !password || (active && !currentCode)}
                >
                  {begin.isPending
                    ? "Preparando…"
                    : active
                      ? "Substituir método"
                      : "Configurar verificação"}
                </Button>
                {active && !status.data.superadmin && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !password || !currentCode}
                    onClick={() => disable.mutate(proof)}
                  >
                    Desativar verificação
                  </Button>
                )}
              </div>
              {active && (
                <p className="text-sm text-muted-foreground">
                  Códigos de recuperação restantes:{" "}
                  {status.data.recoveryCodesRemaining}. Substituir o método gera
                  novos códigos e encerra as outras sessões.
                </p>
              )}
            </form>
          ) : (
            <p>
              Gerencie a verificação em dois fatores no seu provedor de login.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Sessões abertas</CardTitle>
          <CardDescription>
            As sessões expiram após 30 minutos sem atividade e duram no máximo
            12 horas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessions.isLoading ? (
            <p>Carregando sessões…</p>
          ) : sessions.error ? (
            <p role="alert">{sessions.error.message}</p>
          ) : (
            sessions.data?.map(session => (
              <div key={session.id} className="border rounded-md p-3 space-y-2">
                <p className="break-words text-sm">
                  {session.device || "Dispositivo não identificado"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Última atividade:{" "}
                  {new Date(session.lastSeen).toLocaleString("pt-BR")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate({ id: session.id })}
                >
                  Encerrar sessão
                </Button>
              </div>
            ))
          )}
          <Button
            variant="outline"
            disabled={revoke.isPending || !sessions.data?.length}
            onClick={() => revoke.mutate({})}
          >
            Encerrar todas as minhas sessões
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
