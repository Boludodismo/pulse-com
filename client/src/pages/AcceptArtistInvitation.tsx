import {useState} from 'react';
import {useParams} from 'wouter';
import {trpc} from '@/lib/trpc';
import {Button} from '@/components/ui/button';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';
import {Input} from '@/components/ui/input';
import {ARTIST_ACCESS_LABELS} from '@shared/artistInvitations';
export default function AcceptArtistInvitation(){
  const {token=''}=useParams<{token:string}>();
  const auth=trpc.auth.me.useQuery();
  const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [error,setError]=useState('');
  const info=trpc.artistInvitations.inspect.useQuery({token},{retry:false,refetchOnWindowFocus:false});
  const register=trpc.artistInvitations.register.useMutation({onSuccess:()=>{setPassword('');setConfirm('');},onError:e=>setError(e.message)});
  return <main className="min-h-dvh flex items-center justify-center bg-background p-4"><Card className="w-full max-w-lg"><CardHeader><CardTitle>Crie sua conta de artista</CardTitle></CardHeader><CardContent className="space-y-4">
    {auth.data?<p role="alert">Você já está conectado. Abra este convite em uma janela privada ou saia da conta atual antes de criar outra conta.</p>:register.isSuccess?<><p>Conta criada. Entre com seu e-mail e a senha que você definiu.</p><Button asChild><a href="/">Entrar no CRM</a></Button></>:info.isLoading?<p>Verificando convite…</p>:info.error?<p role="alert">{info.error.message}</p>:info.data&&<form className="space-y-4" onSubmit={e=>{e.preventDefault();setError('');if(password!==confirm){setError('As senhas precisam ser iguais.');return;}register.mutate({token,password});}}>
    <p>Olá, {info.data.name}. Você foi convidado para <strong>{info.data.studioName}</strong>.</p>
    <label className="block space-y-2"><span>E-mail do convite</span><Input value={info.data.email} readOnly autoComplete="username"/></label>
    <label className="block space-y-2"><span>Crie uma senha (mínimo 10 caracteres)</span><Input type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)}/></label>
    <label className="block space-y-2"><span>Confirme a senha</span><Input type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
    <div className="text-sm"><p className="font-medium mb-2">Acesso definido pelo proprietário</p>{info.data.permissions.filter(p=>p.canRead).map(p=><p key={p.module}>{ARTIST_ACCESS_LABELS[p.module]}: {p.canWrite?'visualizar e editar':'somente visualizar'}</p>)}<p className="mt-2 text-muted-foreground">Seu perfil e cartão de artista também estarão disponíveis.</p></div>
    {error&&<p role="alert" className="text-destructive">{error}</p>}<Button className="w-full" disabled={register.isPending} type="submit">{register.isPending?'Criando conta…':'Criar minha conta'}</Button>
    </form>}
  </CardContent></Card></main>;
}
