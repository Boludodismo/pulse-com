import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { isInvitedArtist } from '../shared/artistInvitations';
import { hasModulePermission, type SaasModule } from './saas';
import { getDb } from './db';
import * as schema from '../drizzle/schema';

type User = { id: number; openId: string; role: string; studioId: number | null; artistId: number | null };
const denied = () => new TRPCError({code:'FORBIDDEN',message:'Seu acesso não permite esta operação. Solicite a permissão ao proprietário.'});
const self = new Set(['artistInvitations.access','users.changePassword','artists.list','artists.getById','artists.uploadAvatar','studioRelations.card','studioRelations.saveCard','studioRelations.uploadWork','studioRelations.removeWork','intelligentInbox.access']);
const routes: Record<string, SaasModule> = {};
function group(prefix: string, module: SaasModule, operations: string[]) { for (const operation of operations) routes[prefix+'.'+operation]=module; }
group('clients','clients',['list','search','getById','create','update','delete']);
group('notes','clients',['getByClientId','create','delete']);
group('gallery','clients',['getByClientId','uploadImage','create','delete']);
group('appointments','appointments',['list','getByClientId','getById','create','update','delete','checkConflicts','uploadImage','getCalendarLinks','listActionAlerts','markActionAlertViewed']);
group('calendars','appointments',['list','create','update','toggleVisibility','delete']);
group('transactions','finance',['list','getByClientId','getByDateRange','create','createWithMaterials','update','delete']);
group('reports','reports',['monthlyRevenue','categoryBreakdown','paymentMethodBreakdown','summary','artistRevenue']);
group('anamnesis','anamnesis',['getByClientId','getById','exportPdf','create']);
group('anamnese','anamnesis',['getByClientId','getRequestsByClientId','updateSubmission','deleteSubmission','updateRecord','deleteRecord']);
// These newer routers already perform tenant and object checks. Legacy global
// dashboards/search/stock/admin routes intentionally are not allowlisted.
export function invitedRoutePermission(path: string): SaasModule | 'self' | null {
  if (self.has(path)) return 'self';
  if (path==='messaging.getReminderIndicators' || path==='procedures.listLinkedAppointmentIds' || path==='appointments.reminders.list') return 'appointments';
  if (path.startsWith('intelligentInbox.')) return 'intelligent_inbox';
  if (path.startsWith('pod.catalog.') || path.startsWith('pod.inventory.')) return 'stock';
  if (path.startsWith('pod.planning.')) return 'appointments';
  if (path.startsWith('pod.session.') || path.startsWith('procedures.')) return 'pod';
  if (['customerCare.history','customerCare.tags','customerCare.saveTags','customerCare.markRead'].includes(path)) return 'clients';
  return routes[path] ?? null;
}
export async function assertInvitedArtistAccess(user: User, path: string, type: string, rawInput: unknown) {
  if (!isInvitedArtist(user)) return;
  if (!user.studioId || !user.artistId) throw denied();
  const permission = invitedRoutePermission(path);
  if (!permission) throw denied();
  if (permission !== 'self' && !(await hasModulePermission({userId:user.id,studioId:user.studioId,module:permission,write:type==='mutation'}))) throw denied();
  const input = (rawInput && typeof rawInput==='object' ? rawInput : {}) as Record<string, any>;
  if (input.studioId != null && input.studioId !== user.studioId) throw denied();
  if (input.artistId != null && input.artistId !== user.artistId) throw denied();
  if (path === 'transactions.createWithMaterials' && input.materials?.length) throw new TRPCError({code:'FORBIDDEN',message:'Registre o consumo no estoque individual ou na sessão POD.'});
  const db = await getDb(); if (!db) throw new TRPCError({code:'SERVICE_UNAVAILABLE'});
  const client = async (id: number) => {
    const [row] = await db.select({id:schema.clients.id}).from(schema.clients).where(and(eq(schema.clients.id,id),eq(schema.clients.studioId,user.studioId!))).limit(1);
    if (!row) throw denied();
  };
  const tenantRow = async (table: any,id: number) => {
    const [row] = await db.select().from(table).where(and(eq(table.id,id),eq(table.studioId,user.studioId!))).limit(1);
    if (!row) throw denied(); return row as any;
  };
  if (input.clientId != null) await client(input.clientId);
  if (input.appointmentId != null) await tenantRow(schema.appointments,input.appointmentId);
  if (input.calendarId != null) {
    const [row] = await db.select({id:schema.calendars.id}).from(schema.calendars).where(and(eq(schema.calendars.id,input.calendarId),eq(schema.calendars.userId,user.id))).limit(1);
    if (!row) throw denied();
  }
  if (path.startsWith('artists.') && input.id != null && input.id !== user.artistId) throw denied();
  if (path.startsWith('appointments.') && (input.id != null || input.excludeId != null)) {
    const row = await tenantRow(schema.appointments,input.id ?? input.excludeId);
    if (row.artistId !== user.artistId) throw denied();
  }
  if (path === 'appointments.create' && input.artistId !== user.artistId) throw denied();
  if (path.startsWith('appointments.') && input.artist != null) {
    const row = await tenantRow(schema.artists,user.artistId);
    if (input.artist !== row.name) throw denied();
  }
  if (path.startsWith('clients.') && input.id != null) await client(input.id);
  if (path.startsWith('transactions.') && input.id != null) await tenantRow(schema.transactions,input.id);
  const linked: Record<string, any> = {notes:schema.clientNotes,gallery:schema.galleryImages,anamnesis:schema.anamnesisRecords};
  let table = linked[path.split('.')[0]];
  if (['anamnese.updateRecord','anamnese.deleteRecord'].includes(path)) table=schema.anamnesisRecords;
  if (['anamnese.updateSubmission','anamnese.deleteSubmission'].includes(path)) table=schema.anamneseSubmissions;
  if (table && input.id != null) {
    const [row] = await db.select({clientId:table.clientId}).from(table).where(eq(table.id,input.id)).limit(1);
    if (!row) throw denied(); await client(Number(row.clientId));
  }
}
