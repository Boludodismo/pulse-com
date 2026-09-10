import { useEffect, useRef } from "react";
import { useParams } from "wouter";
import { CheckCircle2, Loader2, LogIn, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const auth = trpc.auth.me.useQuery();
  const claim = trpc.saas.claimInvitation.useMutation();
  const claimed = useRef(false);

  useEffect(() => {
    if (!token || !auth.data || claimed.current) return;
    claimed.current = true;
    claim.mutate({ token });
  }, [auth.data, claim, token]);

  if (auth.isLoading || claim.isPending) return <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4"><Card className="w-full max-w-md motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"><CardContent className="flex flex-col items-center gap-3 p-8 text-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /><div aria-live="polite"><p className="font-medium">Validando seu convite</p><p className="mt-1 text-sm text-muted-foreground">Estamos conferindo o acesso e a validade do link.</p></div></CardContent></Card></div>;
  if (!auth.data) return <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4"><Card className="w-full max-w-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"><CardHeader><CardTitle>Convite para o tatuei.com</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Entre com sua conta atual para aceitar o convite. Não é necessário criar uma nova senha; o acesso ficará limitado à empresa vinculada.</p><Button className="w-full" onClick={() => { window.location.href = getLoginUrl(); }}><LogIn className="mr-2 h-4 w-4" />Entrar para continuar</Button></CardContent></Card></div>;
  if (claim.isError) return <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4"><Card className="w-full max-w-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"><CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-destructive" />Convite indisponível</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground" role="alert">{claim.error.message}</p><p className="text-xs text-muted-foreground">Confira se o link está completo, se não foi revogado ou se ainda está dentro do prazo de sete dias.</p></CardContent></Card></div>;
  if (claim.data?.ok) return <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4"><Card className="w-full max-w-md motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95"><CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" />Convite aceito</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Seu acesso à empresa foi vinculado com sucesso. A validade inicial é de 7 dias.</p><Button className="w-full" onClick={() => { window.location.href = "/"; }}>Abrir painel</Button></CardContent></Card></div>;
  return <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4"><Card className="w-full max-w-md"><CardContent className="p-6 text-center text-muted-foreground">Preparando convite…</CardContent></Card></div>;
}
