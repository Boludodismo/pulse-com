import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Lock, Mail, CheckCircle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface LocalLoginProps {
  onSuccess: () => void;
}

export default function LocalLogin({ onSuccess }: LocalLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mfa, setMfa] = useState<{ challenge: string; method: string }>();
  const [code, setCode] = useState("");
  const [recoveryOnly, setRecoveryOnly] = useState(false);

  // Estado do modal "Esqueci minha senha"
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const requestResetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setForgotSent(true);
      setForgotError(null);
    },
    onError: (err) => {
      setForgotError(err.message || "Erro ao solicitar recuperação. Tente novamente.");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(mfa ? "/api/auth/local/mfa" : "/api/auth/local/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(mfa ? { challenge: mfa.challenge, code } : { email: email.trim().toLowerCase(), password, recoveryOnly }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "E-mail ou senha incorretos.");
        return;
      }

      if (data.mfaRequired) { setMfa({ challenge: data.challenge, method: data.method }); setPassword(""); setCode(""); return; }
      onSuccess();
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    requestResetMutation.mutate({ email: forgotEmail.trim().toLowerCase() });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="w-full max-w-sm px-4">
        {/* Logo / título */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <img src="/tatuei-logo.png" alt="Logo tatuei.com" className="w-16 h-16 object-contain" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">tatuei.com</h1>
          <p className="text-sm text-muted-foreground text-center">
            Estúdios de Tatuagem
          </p>
        </div>

        <Card className="border border-border shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">{mfa ? "Confirme seu acesso" : "Entrar no sistema"}</CardTitle>
            <CardDescription>
              {mfa ? (mfa.method === "email" && !recoveryOnly ? "Informe o código enviado ao seu e-mail ou um código de recuperação." : "Informe o código do autenticador ou um código de recuperação.") : "Use o e-mail e senha fornecidos pelo administrador."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" role="alert" aria-live="assertive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {!mfa && <>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    autoComplete="email"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email);
                      setForgotSent(false);
                      setForgotError(null);
                      setForgotOpen(true);
                    }}
                    className="text-xs text-primary hover:underline focus:outline-none"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={recoveryOnly} onChange={e => setRecoveryOnly(e.target.checked)} disabled={loading} />Usar código de recuperação em vez de receber e-mail</label>
              </>}
              {mfa && <div className="space-y-2"><Label htmlFor="mfa-code">Código de verificação ou recuperação</Label><Input id="mfa-code" value={code} onChange={e => setCode(e.target.value)} autoComplete="one-time-code" autoFocus required maxLength={64} disabled={loading} /><p className="text-xs text-muted-foreground">A verificação expira em 5 minutos. Cada código de recuperação só pode ser usado uma vez.</p><Button type="button" variant="ghost" onClick={() => { setMfa(undefined); setCode(""); setError(null); }} disabled={loading}>Voltar ao login</Button></div>}
              <Button type="submit" className="w-full" disabled={loading || (mfa ? !code : !email || !password)}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</> : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Problemas para acessar? Contate o administrador do estúdio.
        </p>
      </div>

      {/* Modal Esqueci minha senha */}
      <Dialog open={forgotOpen} onOpenChange={(open) => {
        setForgotOpen(open);
        if (!open) { setForgotSent(false); setForgotError(null); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recuperar senha</DialogTitle>
            <DialogDescription>
              Informe seu e-mail para receber um link de redefinição, quando o envio de e-mail estiver configurado.
            </DialogDescription>
          </DialogHeader>

          {forgotSent ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <div className="text-center">
                <p className="font-medium text-foreground">Solicitação enviada!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Se houver uma conta ativa com este e-mail e o envio estiver disponível, você receberá o link. Verifique também a caixa de spam.
                </p>
              </div>
              <Button variant="outline" onClick={() => setForgotOpen(false)} className="w-full">
                Fechar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              {forgotError && (
                <Alert variant="destructive">
                  <AlertDescription>{forgotError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="forgot-email">E-mail cadastrado</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="pl-9"
                    required
                    disabled={requestResetMutation.isPending}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForgotOpen(false)}
                  className="flex-1"
                  disabled={requestResetMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={requestResetMutation.isPending || !forgotEmail}
                >
                  {requestResetMutation.isPending ? "Enviando..." : "Enviar link"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
