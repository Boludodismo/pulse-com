import { appointmentInstant } from './appointmentTime';

export const ATTENDANCE_ACTIONS = ['present', 'late', 'no_show', 'start', 'progress', 'finish', 'needs_more'] as const;
export type AttendanceAction = typeof ATTENDANCE_ACTIONS[number];
export const NO_SHOW_TAG = 'Não compareceu';
export const isNoShowTag = (label:string) => label.trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR')===NO_SHOW_TAG.toLocaleLowerCase('pt-BR');
export const attendanceLabels: Record<AttendanceAction, string> = {
  present: 'Confirmar presença', late: 'Cliente atrasado', no_show: 'Não compareceu',
  start: 'Iniciar sessão', progress: 'Ainda em andamento', finish: 'Finalizar sessão',
  needs_more: 'Finalizar sessão · precisa de outras sessões',
};
export type AttendanceState = {
  attendance: 'pending' | 'present' | 'late' | 'no_show';
  session: 'not_started' | 'in_progress' | 'completed';
  needsMore: boolean;
};
export const emptyAttendance: AttendanceState = { attendance: 'pending', session: 'not_started', needsMore: false };

/** Presence is an operational check-in, independent of the customer's earlier RSVP. */
export function transitionAttendance(state: AttendanceState, action: AttendanceAction): AttendanceState {
  if (state.session === 'completed') {
    if(action==='needs_more')return state.needsMore?state:{...state,needsMore:true};
    if (action === 'finish' && !state.needsMore) return state;
    throw new Error('Esta sessão já foi finalizada. Atualize a página para consultar o registro.');
  }
  if (action === 'no_show' && (state.attendance === 'present' || state.session === 'in_progress'))
    throw new Error('Já existe presença ou início registrado. Confira o atendimento antes de registrar uma falta.');
  if (action === 'late' && state.attendance === 'present') throw new Error('A presença deste cliente já foi confirmada.');
  if (['start', 'progress', 'finish', 'needs_more'].includes(action) && state.attendance === 'no_show')
    throw new Error('Confirme a presença para corrigir a falta antes de iniciar ou finalizar a sessão.');
  if (action === 'present') return { ...state, attendance: 'present' };
  if (action === 'late') return { ...state, attendance: 'late' };
  if (action === 'no_show') return { ...state, attendance: 'no_show' };
  if (action === 'start' || action === 'progress') return { ...state, attendance: 'present', session: 'in_progress' };
  return { attendance: 'present', session: 'completed', needsMore: action === 'needs_more' };
}

export function attendanceClock(now: Date, timezone = 'America/Sao_Paulo') {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const p = (key: string) => parts.find(v => v.type === key)!.value;
  return `${p('year')}-${p('month')}-${p('day')} ${p('hour')}:${p('minute')}:${p('second')}`;
}
export function attendanceSlot(input: { date: string; duration: number; activatedAt: string; now: string; state: AttendanceState }): 'start' | 'end' | null {
  const start = appointmentInstant(input.date).getTime(), now = appointmentInstant(input.now).getTime();
  const end = start + input.duration * 60000;
  if (input.date < input.activatedAt || input.state.attendance === 'no_show' || input.state.session === 'completed') return null;
  // Recover delayed scheduler runs without sending old arrival questions after the session's end.
  if (now >= end && now < end + 24 * 3600000) return 'end';
  if (now >= start && now < end && input.state.attendance !== 'present') return 'start';
  return null;
}
