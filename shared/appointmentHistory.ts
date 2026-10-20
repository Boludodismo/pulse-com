export const APPOINTMENT_HISTORY_MESSAGE = 'Este atendimento já faz parte do histórico. Para escolher outra data ou horário, crie uma nova sessão em “Agendar outra sessão”.';
type Slot = {date:string;duration:number;calendarId?:number|null};
export function changesAppointmentSlot(before:Slot,patch:Partial<Slot>) {
  const wall=(value:string)=>value.replace('T',' ').replace(/Z$/,'').slice(0,19);
  return (patch.date!==undefined&&wall(patch.date)!==wall(before.date))
    ||(patch.duration!==undefined&&patch.duration!==before.duration)
    ||(patch.calendarId!==undefined&&(patch.calendarId??null)!==(before.calendarId??null));
}
export function appointmentHasHistory(appointment:{status?:string;attendanceStatus?:string|null;sessionStatus?:string|null}|null|undefined) {
  return !!appointment && (appointment.status==='concluido'||!!appointment.attendanceStatus||(!!appointment.sessionStatus&&appointment.sessionStatus!=='not_started'));
}
export const appointmentContinuationUrl=(appointmentId:number)=>`/schedule?continuar=${appointmentId}`;
