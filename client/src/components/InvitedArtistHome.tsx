import {useAuth} from '@/_core/hooks/useAuth';
import {trpc} from '@/lib/trpc';
import ArtistCardEditor from './ArtistCardEditor';
import {ARTIST_ACCESS_LABELS} from '@shared/artistInvitations';
import {Card,CardContent,CardHeader,CardTitle} from './ui/card';
export default function InvitedArtistHome(){
 const {user}=useAuth();const access=trpc.artistInvitations.access.useQuery();
 return <div className="space-y-4"><h1 className="text-2xl font-semibold">Olá, {user?.name?.split(' ')[0]}</h1><Card><CardHeader><CardTitle>Seu espaço de artista</CardTitle></CardHeader><CardContent className="space-y-3"><p>Use o menu para acessar as áreas liberadas pelo proprietário.</p>{access.data?.filter(p=>!!p.canRead).map(p=><p key={p.module}>{ARTIST_ACCESS_LABELS[p.module]} — {p.canWrite?'visualizar e editar':'somente visualizar'}</p>)}{user?.artistId&&<ArtistCardEditor artistId={user.artistId} name={user.name??'Artista'}/>}</CardContent></Card></div>;
}
