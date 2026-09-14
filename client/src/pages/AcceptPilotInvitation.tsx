import { useState } from 'react';
import { useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function AcceptPilotInvitation() {
  const {token = ''} = useParams<{token:string}>();
  const auth = trpc.auth.me.useQuery();
  const invitation = trpc.saas.inspectPilot.useQuery({token},{retry:false});
  const register = trpc.saas.registerPilot.useMutation();
  const [name,setName] = useState('');
  const [email,setEmail] = useState('');
  const [studioName,setStudioName] = useState('');
  const [password,setPassword] = useState('');
  const [confirmation,setConfirmation] = useState('');
  const [error,setError] = useState('');
  return <main className="min-h-screen bg-background px-4 py-10 text-foreground"><Card className="mx-auto max-w-lg">
    <CardHeader><CardTitle>Seu estúdio no tatuei.com</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {auth.isLoading || invitation.isLoading ? <p>Validando convite…</p> : auth.data ?
        <p role="alert">Você está conectado. Abra este link em uma janela privada para criar um acesso separado. Sua conta atual não será alterada.</p> : invitation.error ?
        <p role="alert">{invitation.error.message}</p> : register.isSuccess ? <>
          <p role="status">Cadastro concluído! Entre com o e-mail e a senha que você acabou de cadastrar.</p>
          <Button asChild className="w-full"><a href="/">Entrar no sistema</a></Button>
        </> : <form className="space-y-4" onSubmit={e=>{e.preventDefault();setError('');if(password!==confirmation){setError('As senhas não coincidem.');return;}register.mutate({token,name,email,password,studioName:studioName || invitation.data?.studioName || ''});}}>
          <p className="text-sm text-muted-foreground">Piloto gratuito, sem cobrança. Este cadastro é independente dos demais estúdios. Use o e-mail informado ao receber o convite.</p>
          <div className="space-y-2"><Label htmlFor="pilot-name">Seu nome</Label><Input id="pilot-name" autoComplete="name" required minLength={2} maxLength={150} value={name} onChange={e=>setName(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="pilot-email">E-mail do convite</Label><Input id="pilot-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="pilot-studio">Nome do estúdio</Label><Input id="pilot-studio" required minLength={2} maxLength={255} value={studioName || invitation.data?.studioName || ''} onChange={e=>setStudioName(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="pilot-password">Senha (mínimo de 10 caracteres)</Label><Input id="pilot-password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="pilot-confirm">Confirme a senha</Label><Input id="pilot-confirm" type="password" autoComplete="new-password" required value={confirmation} onChange={e=>setConfirmation(e.target.value)} /></div>
          {(error || register.error) && <p role="alert" className="text-sm text-destructive">{error || register.error?.message}</p>}
          <Button className="w-full" disabled={register.isPending}>{register.isPending?'Criando cadastro…':'Criar meu acesso gratuito'}</Button>
        </form>}
    </CardContent>
  </Card></main>;
}
