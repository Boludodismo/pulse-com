export type SessionPause = {startedAt:string;endedAt:string|null};
/** Whole active seconds, excluding both completed and currently open pauses. */
export function effectiveSessionSeconds(startedAt:string|null,finishedAt:string|null,pauses:SessionPause[],now=Date.now()) {
 if(!startedAt)return 0;
 const start=new Date(startedAt).getTime(),end=finishedAt?new Date(finishedAt).getTime():now;
 if(!Number.isFinite(start)||!Number.isFinite(end))return 0;
 const paused=pauses.reduce((sum,pause)=>{
  const from=Math.max(start,new Date(pause.startedAt).getTime());
  const to=Math.min(end,pause.endedAt?new Date(pause.endedAt).getTime():now);
  return sum+(Number.isFinite(from)&&Number.isFinite(to)?Math.max(0,to-from):0);
 },0);
 return Math.max(0,Math.floor((end-start-paused)/1000));
}
