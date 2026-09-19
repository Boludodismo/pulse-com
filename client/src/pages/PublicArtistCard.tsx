import {useRoute} from 'wouter';
import {trpc} from '@/lib/trpc';
import ArtistEditorialCard from '@/components/artist-card/ArtistEditorialCard';

export default function PublicArtistCard(){
  const [,params]=useRoute('/artista/:token');
  const token=params?.token||'';
  const valid=/^[a-f0-9]{48}$/.test(token);
  const q=trpc.studioRelations.publicCard.useQuery({token},{enabled:valid,retry:false});
  if(valid&&q.isLoading)return <main className="min-h-screen bg-black p-8 text-zinc-200" role="status">Carregando cartão…</main>;
  if(!valid||!q.data)return <main className="min-h-screen bg-black p-8 text-zinc-200"><h1 className="text-2xl">Cartão indisponível</h1><p>O artista pode ter pausado a publicação.</p></main>;
  return <ArtistEditorialCard {...q.data}/>;
}
