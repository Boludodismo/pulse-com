import { createHash, randomBytes } from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import { TRPCError } from '@trpc/server';
import { database } from '../commitments/db';
import { attendanceClock, attendanceSlot, emptyAttendance, transitionAttendance, NO_SHOW_TAG, type AttendanceAction, type AttendanceState } from '../../shared/attendance';
import { firstName } from '../messaging/messagePresentation';
import { normalizeBrazilianPhone } from '../messaging/phone';

const utc = (now = new Date()) => now.toISOString().slice(0,19).replace('T',' ');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export function attendanceFingerprint(a: any) {
  return hash(JSON.stringify([a.studioId,a.id,a.clientId,a.artistId ?? null,a.artist,a.date,a.duration,a.attendanceRecipient ?? 'artist',a.attendanceEnabled ?? 1]));
}
export const stateFromRow = (row?: any): AttendanceState => row ? {attendance:row.attendance,session:row.session,needsMore:!!row.needs_more} : {...emptyAttendance};
async function rows(sql: string, values: any[] = []) { return (await database().query<any[]>(sql, values))[0]; }

async function appointment(id: number, studioId: number) {
  return (await rows(`SELECT a.*,c.name AS clientName FROM appointments a INNER JOIN clients c ON c.id=a.clientId AND c.studioId=a.studioId AND c.isArchived=0 WHERE a.id=? AND a.studioId=?`,[id,studioId]))[0];
}
export async function requireAttendanceAppointment(id: number, studioId: number, artistId?: number | null, collaborator = false) {
  const a = await appointment(id,studioId);
  if (!a || (collaborator && (!artistId || a.artistId !== artistId))) throw new TRPCError({code:'FORBIDDEN',message:'Agendamento indisponível para este usuário.'});
  return a;
}
async function view(a: any) {
  const [r] = await rows('SELECT * FROM appointment_attendance WHERE appointment_id=? AND studio_id=?',[a.id,a.studioId]);
  if (r && (r.client_id!==a.clientId || r.artist_id!==a.artistId)) throw new Error('O vínculo do atendimento foi alterado. Confira o histórico no CRM.');
  return {appointmentId:a.id,clientName:firstName(a.clientName),clientId:a.clientId,date:a.date,duration:a.duration,service:a.service,artist:a.artist,
    state:stateFromRow(r),revision:r?.revision ?? 0,presentAt:r?.present_at ?? null,startedAt:r?.started_at ?? null,finishedAt:r?.finished_at ?? null};
}
export async function attendanceView(id: number, studioId: number, artistId?: number | null, collaborator = false) {
  return view(await requireAttendanceAppointment(id,studioId,artistId,collaborator));
}

export async function issueAttendanceLink(a: any) {
  const token = randomBytes(32).toString('hex');
  await database().query('INSERT INTO appointment_attendance_links(token_hash,studio_id,appointment_id,fingerprint,expires_at) VALUES(?,?,?,?,?)',
    [hash(token),a.studioId,a.id,attendanceFingerprint(a),utc(new Date(Date.now()+7*86400000))]);
  const origin = (process.env.PUBLIC_URL || process.env.APP_BASE_URL || 'https://crm.tatuei.com').replace(/\/$/,'');
  return `${origin}/atendimento/${token}`;
}
async function tokenAppointment(token: string) {
  const [link] = await rows('SELECT * FROM appointment_attendance_links WHERE token_hash=? AND expires_at>UTC_TIMESTAMP()',[hash(token)]);
  const a = link ? await appointment(link.appointment_id,link.studio_id) : null;
  if (!a || ['cancelado','reagendado'].includes(a.status) || a.attendanceEnabled!==1 || attendanceFingerprint(a)!==link.fingerprint)
    throw new TRPCError({code:'NOT_FOUND',message:'Este link expirou ou o agendamento foi alterado. Abra o atendimento pela agenda.'});
  return {a,link};
}
export async function publicAttendanceView(token: string) {
  const {a} = await tokenAppointment(token);
  const result = await view(a);
  // No contact details, medical data, other appointments or customer ID in public capabilities.
  const {clientId,...limited} = result;
  return limited;
}

export async function applyAttendance(input: {appointmentId:number;studioId:number;action:AttendanceAction;revision:number;source:string;fingerprint?:string;actorArtistId?:number}) {
  const c = await database().getConnection();
  try {
    await c.beginTransaction();
    const [[a]]: any = await c.query('SELECT * FROM appointments WHERE id=? AND studioId=? FOR UPDATE',[input.appointmentId,input.studioId]);
    if (!a || (input.actorArtistId!==undefined && a.artistId!==input.actorArtistId) || ['cancelado','reagendado'].includes(a.status) || (input.fingerprint && (attendanceFingerprint(a)!==input.fingerprint || a.attendanceEnabled!==1)))
      throw new Error('O agendamento foi alterado ou cancelado. Atualize a página.');
    const [[client]]: any = await c.query('SELECT id FROM clients WHERE id=? AND studioId=? AND isArchived=0 FOR UPDATE',[a.clientId,a.studioId]);
    if (!client) throw new Error('Cliente indisponível.');
    const [[settings]]: any = await c.query('SELECT timezone FROM message_automation_settings WHERE studio_id=? LIMIT 1',[a.studioId]);
    if (attendanceClock(new Date(),settings?.timezone || 'America/Sao_Paulo').slice(0,10)<a.date.slice(0,10)) throw new Error('Registre o atendimento a partir do dia agendado.');
    const [[previous]]: any = await c.query('SELECT * FROM appointment_attendance WHERE appointment_id=? AND studio_id=? FOR UPDATE',[a.id,a.studioId]);
    if (previous && (previous.client_id!==a.clientId || previous.artist_id!==a.artistId)) throw new Error('O vínculo do atendimento mudou. Confira o histórico no CRM.');
    const before = stateFromRow(previous), next = transitionAttendance(before,input.action);
    if (JSON.stringify(before)===JSON.stringify(next)) { await c.commit(); return {ok:true,duplicate:true}; }
    if ((previous?.revision ?? 0)!==input.revision) throw new TRPCError({code:'CONFLICT',message:'Outra ação já atualizou este atendimento. Atualize a página antes de continuar.'});
    const now = utc(), presentAt = previous?.present_at || (next.attendance==='present' ? now : null);
    const startedAt = previous?.started_at || (next.session==='in_progress' ? now : null);
    const finishedAt = previous?.finished_at || (next.session==='completed' ? now : null);
    await c.query(`INSERT INTO appointment_attendance(appointment_id,studio_id,client_id,artist_id,attendance,session,needs_more,present_at,started_at,finished_at,revision,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,1,?) ON DUPLICATE KEY UPDATE attendance=VALUES(attendance),session=VALUES(session),needs_more=VALUES(needs_more),present_at=VALUES(present_at),started_at=VALUES(started_at),finished_at=VALUES(finished_at),revision=revision+1,updated_at=VALUES(updated_at)`,
      [a.id,a.studioId,a.clientId,a.artistId,next.attendance,next.session,next.needsMore?1:0,presentAt,startedAt,finishedAt,now]);
    await c.query('INSERT INTO appointment_attendance_events(appointment_id,studio_id,client_id,artist_id,action,source,created_at) VALUES(?,?,?,?,?,?,?)',[a.id,a.studioId,a.clientId,a.artistId,input.action,input.source,now]);
    if (next.attendance==='present') {
      await c.query(`INSERT INTO care_sessions(studio_id,client_id,artist_id,appointment_id,source_key,completed_at) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE source_key=VALUES(source_key)`,[a.studioId,a.clientId,a.artistId,a.id,`appointment:${a.id}`,presentAt]);
    }
    if (next.session==='completed') await c.query("UPDATE appointments SET status='concluido',confirmationStatus='confirmado' WHERE id=? AND studioId=?",[a.id,a.studioId]);
    else if (next.attendance==='present') await c.query("UPDATE appointments SET confirmationStatus='confirmado' WHERE id=? AND studioId=?",[a.id,a.studioId]);
    else if (next.attendance==='late') await c.query("UPDATE appointments SET confirmationStatus='atraso' WHERE id=? AND studioId=?",[a.id,a.studioId]);
    else if (next.attendance==='no_show') await c.query("UPDATE appointments SET confirmationStatus='nao_confirmado' WHERE id=? AND studioId=?",[a.id,a.studioId]);
    await refreshNoShowTag(c,a.studioId,a.clientId);
    await c.commit();
    return {ok:true,duplicate:false};
  } catch(error) { await c.rollback(); throw error; } finally { c.release(); }
}
async function refreshNoShowTag(c: PoolConnection,studioId:number,clientId:number) {
  const [[count]]: any = await c.query("SELECT COUNT(*) AS total FROM appointment_attendance WHERE studio_id=? AND client_id=? AND attendance='no_show'",[studioId,clientId]);
  if (Number(count.total)) await c.query('INSERT INTO care_tags(studio_id,client_id,label) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM care_tags WHERE studio_id=? AND client_id=? AND label=?)',[studioId,clientId,NO_SHOW_TAG,studioId,clientId,NO_SHOW_TAG]);
  else await c.query('DELETE FROM care_tags WHERE studio_id=? AND client_id=? AND label=?',[studioId,clientId,NO_SHOW_TAG]);
}
export async function applyPublicAttendance(input: {token:string;action:AttendanceAction;revision:number}) {
  const {a,link} = await tokenAppointment(input.token);
  return applyAttendance({appointmentId:a.id,studioId:a.studioId,action:input.action,revision:input.revision,source:'whatsapp_link',fingerprint:link.fingerprint});
}

export async function attendanceHistory(clientId:number,studioId:number,artistId?:number|null,collaborator=false) {
  const [client] = await rows('SELECT id FROM clients WHERE id=? AND studioId=?',[clientId,studioId]);
  if (!client || (collaborator && !artistId)) throw new TRPCError({code:'FORBIDDEN'});
  const scope=collaborator?' AND artist_id=?':'';
  const params=collaborator?[studioId,clientId,artistId]:[studioId,clientId];
  const events = await rows(`SELECT appointment_id AS appointmentId,action,created_at AS createdAt FROM appointment_attendance_events WHERE studio_id=? AND client_id=?${scope} ORDER BY id DESC LIMIT 100`,params);
  const [count] = await rows(`SELECT COUNT(*) AS total FROM appointment_attendance WHERE studio_id=? AND client_id=? AND attendance='no_show'${scope}`,params);
  return {noShowCount:Number(count.total),events};
}

/** Revalidated by the worker: changing the recipient, date, artist or duration invalidates queued notices. */
export async function attendanceNoticeContext(studioId:number,trigger?:string|null) {
  const match=/^attendance:(start|end):(\d+):([a-f0-9]{64})$/.exec(trigger||'');
  if (!match) return null;
  const a=await appointment(Number(match[2]),studioId);
  if (!a || a.attendanceEnabled!==1 || ['cancelado','reagendado','concluido'].includes(a.status) || attendanceFingerprint(a)!==match[3]) return null;
  const [r]=await rows('SELECT * FROM appointment_attendance WHERE appointment_id=? AND studio_id=?',[a.id,studioId]);
  if(r && (r.client_id!==a.clientId||r.artist_id!==a.artistId))return null;
  const state=stateFromRow(r);
  if (state.attendance==='no_show'||state.session==='completed'||(match[1]==='start'&&state.attendance==='present')) return null;
  const [settings]=await rows('SELECT timezone FROM message_automation_settings WHERE studio_id=? LIMIT 1',[studioId]);
  if(attendanceSlot({date:a.date,duration:a.duration,activatedAt:'0000-00-00 00:00:00',now:attendanceClock(new Date(),settings?.timezone||'America/Sao_Paulo'),state})!==match[1])return null;
  return a;
}
export async function attendanceStudioNoticePhone(studioId:number,trigger?:string|null) {
  const a=await attendanceNoticeContext(studioId,trigger);
  if (!a || a.attendanceRecipient!=='studio') return null;
  const [s]=await rows('SELECT phone FROM studioSettings WHERE studioId=? LIMIT 1',[studioId]);
  return s?.phone || null;
}

export async function runAttendanceCycle() {
  const [runtime]=await rows('SELECT activated_at FROM attendance_runtime WHERE id=1');
  if (!runtime) return;
  const candidates=await rows(`SELECT a.*,c.name AS clientName,m.timezone FROM appointments a INNER JOIN clients c ON c.id=a.clientId AND c.studioId=a.studioId AND c.isArchived=0 LEFT JOIN message_automation_settings m ON m.studio_id=a.studioId WHERE a.attendanceEnabled=1 AND a.status IN ('agendado','confirmado') AND a.date>=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 2 DAY) AND a.date<=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY)`);
  const result={queued:0,skipped:0,failed:0};
  for (const a of candidates) try {
    const timezone=a.timezone||'America/Sao_Paulo';
    const [r]=await rows('SELECT * FROM appointment_attendance WHERE appointment_id=? AND studio_id=?',[a.id,a.studioId]);
    if (r && (r.client_id!==a.clientId||r.artist_id!==a.artistId)) {result.skipped++;continue;}
    const slot=attendanceSlot({date:a.date,duration:a.duration,state:stateFromRow(r),now:attendanceClock(new Date(),timezone),activatedAt:attendanceClock(new Date(runtime.activated_at.replace(' ','T')+'Z'),timezone)});
    if (!slot) continue;
    const fingerprint=attendanceFingerprint(a),trigger=`attendance:${slot}:${a.id}:${fingerprint}`,key=`attendance:${slot}:${a.studioId}:${a.id}:${fingerprint}`;
    const [queued]=await rows('SELECT id FROM integration_jobs WHERE studio_id=? AND idempotency_key=? LIMIT 1',[a.studioId,key]);
    if (queued) continue;
    const makeMessage=async()=>{const link=await issueAttendanceLink(a), name=firstName(a.clientName);return slot==='start'
      ? `Chegou o horário do atendimento de ${name}.\n${a.service} · ${a.date.slice(0,16).replace(' ',' às ')}\n\nRegistre a presença, atraso, falta ou início da sessão:\n${link}`
      : `O tempo previsto para a sessão de ${name} terminou.\n\nA sessão foi finalizada, continua em andamento ou precisa de outras sessões? Registre aqui e, se necessário, agende a continuidade:\n${link}`;};
    if (a.attendanceRecipient==='studio') {
      const phone=await attendanceStudioNoticePhone(a.studioId,trigger);
      const [integration]=await rows(`SELECT w.id FROM whatsapp_integrations w LEFT JOIN users u ON u.id=w.production_activated_by_user_id AND u.studioId=w.studio_id WHERE w.studio_id=? AND w.status='ativo' AND w.is_enabled=1 AND w.sandbox_mode=0 AND (u.role IS NULL OR u.role<>'collaborator') ORDER BY w.id LIMIT 1`,[a.studioId]);
      if (!phone||!integration) {result.skipped++;continue;}
      const {sendAndLog}=await import('../messaging/service');
      const sent=await sendAndLog({studioId:a.studioId,appointmentId:a.id,clientId:a.clientId,integrationId:integration.id,recipientType:'artist',operationalRecipient:'studio',recipientPhone:normalizeBrazilianPhone(phone),recipientName:'Estúdio',trigger,message:await makeMessage(),idempotencyKey:key});
      if(sent.success)result.queued++;else result.failed++;
    } else {
      const {queueArtistOperationalNotice}=await import('../messaging/artistNotifications');
      if (!a.artistId) {result.skipped++;continue;}
      const ok=await queueArtistOperationalNotice({studioId:a.studioId,appointmentId:a.id,clientId:a.clientId,artistId:a.artistId,trigger,message:makeMessage,idempotencyKey:key});
      if(ok)result.queued++;else result.skipped++;
    }
  } catch { result.failed++; console.warn('[Attendance] Atendimento não processado.',{studioId:a.studioId,appointmentId:a.id}); }
  if(result.queued||result.skipped||result.failed)console.log('[Attendance] Ciclo de atendimento',result);
  return result;
}
