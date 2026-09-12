import { INBOX_MODULE_LABELS } from './intelligentInbox';
export const ARTIST_ACCESS_LABELS = {
  clients: 'Clientes', appointments: 'Agenda e calendário', stock: 'Estoque',
  finance: 'Financeiro', anamnesis: 'Anamnese', pod: 'POD / sessões', reports: 'Relatórios',
  ...INBOX_MODULE_LABELS,
} as const;
export type ArtistAccessModule = keyof typeof ARTIST_ACCESS_LABELS;
export type ArtistPermission = { module: ArtistAccessModule; canRead: boolean; canWrite: boolean };
export function isInvitedArtist(user?: { openId?: string; role?: string } | null) {
  return user?.role === 'collaborator' && !!user.openId?.startsWith('artist-invite:');
}
/** Explicit route map: unknown management screens remain inaccessible to invitees. */
export function artistRouteModule(path: string): ArtistAccessModule | 'self' | null {
  if (path==='/' || path==='/artists') return 'self';
  if (path==='/clients' || path.startsWith('/clients/')) return 'clients';
  if (path==='/schedule' || path==='/calendar') return 'appointments';
  if (path==='/stock') return 'stock';
  if (path==='/reports') return 'reports';
  if (path==='/procedures' || path.startsWith('/procedures/')) return 'pod';
  if (path==='/intelligent-inbox') return 'intelligent_inbox';
  return null;
}
