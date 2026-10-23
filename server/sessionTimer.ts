import { TRPCError } from '@trpc/server';
import { and, eq, isNull, desc } from 'drizzle-orm';
import { technicalProcedures, procedurePauses, procedureEvents } from '../drizzle/schema';
import { getDb } from './db';
import { assertSessionLinks } from './recordAccess';
import { snapshotSessionMaterials } from './sessionMaterials';
import { effectiveMinutes } from '../shared/sessionFinalization';

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Actor = { role: string; studioId: number | null; artistId: number | null };
const conflict = () => new TRPCError({ code: 'CONFLICT', message: 'Transição de cronômetro incompatível. Atualize a sessão; sessões encerradas não podem ser reabertas aqui.' });

/** All entry points lock the same persisted parent before reading or writing pauses. */
export async function transitionSessionTimer(database: Database, actor: Actor, id: number, action: 'start'|'pause'|'resume'|'finish', reason?: string) {
  return database.transaction(async tx => {
    const [procedure] = await tx.select().from(technicalProcedures).where(eq(technicalProcedures.id, id)).limit(1).for('update');
    if (!procedure) throw new TRPCError({code:'NOT_FOUND'});
    if (!actor.studioId || actor.studioId !== procedure.studioId) throw new TRPCError({code:"FORBIDDEN"});
    await assertSessionLinks(tx as unknown as Database, actor, procedure);
    const pauses = await tx.select().from(procedurePauses).where(and(eq(procedurePauses.procedureId,id), eq(procedurePauses.studioId,procedure.studioId))).orderBy(desc(procedurePauses.id));
    const open = pauses.filter(p=>!p.endedAt);
    if (open.length > 1) throw conflict(); // Do not repair ambiguous historical records.
    const replay = () => ({ procedure, pause: open[0] ?? pauses[0] ?? null, replayed: true });
    if (procedure.status==='finalizado') {
      if (action==='finish') return replay();
      throw conflict();
    }
    if (action==='start' && procedure.startedAt && procedure.status==='em_andamento' && !open.length) return replay();
    if (action==='pause' && procedure.status==='pausado' && open.length===1) return replay();
    if (action==='resume' && procedure.startedAt && procedure.status==='em_andamento' && !open.length && pauses.length) return replay();
    const now = new Date().toISOString().slice(0,19).replace('T',' ');
    let pause = open[0] ?? null;
    const updates: Partial<typeof technicalProcedures.$inferInsert> = {};
    if (action==='start') {
      if (procedure.startedAt || procedure.status!=='em_andamento' || open.length) throw conflict();
      await snapshotSessionMaterials(tx as unknown as Database, procedure);
      updates.startedAt=now;
    } else {
      if (!procedure.startedAt || !['em_andamento','pausado'].includes(procedure.status)) throw conflict();
      if (procedure.status==='pausado' && (!pause || !procedure.pausedAt)) throw conflict();
      if (action==='pause') {
        if (procedure.status!=='em_andamento' || pause) throw conflict();
        const [inserted] = await tx.insert(procedurePauses).values({studioId:procedure.studioId, procedureId:id, artistId:procedure.artistId, startedAt:now, reason:reason??null});
        pause=(await tx.select().from(procedurePauses).where(eq(procedurePauses.id,Number(inserted.insertId))).limit(1))[0];
        updates.status='pausado'; updates.pausedAt=now;
      } else {
        if (action==='resume' && !pause) throw conflict();
        if (pause) {
          await tx.update(procedurePauses).set({endedAt:now}).where(and(eq(procedurePauses.id,pause.id),isNull(procedurePauses.endedAt)));
          pause={...pause,endedAt:now};
        }
        updates.pausedAt=null;
        updates.status=action==='finish'?'finalizado':'em_andamento';
        if(action==='finish') {
          updates.finishedAt=now;
          updates.totalDurationMinutes=effectiveMinutes(procedure.startedAt,now,pauses.map(p=>p.id===pause?.id?pause!:p));
        }
      }
    }
    await tx.update(technicalProcedures).set(updates).where(eq(technicalProcedures.id,id));
    await tx.insert(procedureEvents).values({procedureId:id,eventType:action,payload:JSON.stringify({at:now})});
    const [updated] = await tx.select().from(technicalProcedures).where(eq(technicalProcedures.id,id)).limit(1);
    return { procedure:updated, pause, replayed:false };
  });
}

export function technicalTiming(startedAt:string|null,finishedAt:string|null,pauses:Array<{startedAt:string;endedAt:string|null}>,now=Date.now()) {
  const parse=(value:string)=>Date.parse(value.replace(' ','T')+'Z');
  const end=finishedAt?parse(finishedAt):now;
  const start=startedAt?parse(startedAt):end;
  let paused=0,last=start;
  const intervals=pauses.map(p=>[Math.max(start,parse(p.startedAt)),Math.min(end,p.endedAt?parse(p.endedAt):end)])
    .filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b>a).sort((a,b)=>a[0]-b[0]);
  for(const [a,b] of intervals){paused+=Math.max(0,b-Math.max(a,last));last=Math.max(last,b);}
  const total=Math.max(0,end-start), effective=Math.max(0,total-paused);
  return {totalMinutes:Math.floor(total/60000),pausedMinutes:Math.floor(paused/60000),effectiveMinutes:Math.floor(effective/60000),effectiveSeconds:Math.floor(effective/1000)};
}
