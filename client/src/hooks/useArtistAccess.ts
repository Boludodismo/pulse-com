import {useAuth} from '@/_core/hooks/useAuth';
import {trpc} from '@/lib/trpc';
import {isInvitedArtist,type ArtistAccessModule} from '@shared/artistInvitations';
export function useArtistAccess(){
 const {user}=useAuth(); const invited=isInvitedArtist(user);
 const query=trpc.artistInvitations.access.useQuery(undefined,{enabled:invited});
 const can=(module:ArtistAccessModule,write=false)=>!invited||!!query.data?.some(p=>p.module===module&&(write?!!p.canWrite:!!p.canRead));
 return {invited,can};
}
