import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {attendanceClock,attendanceSlot,emptyAttendance,isNoShowTag,transitionAttendance} from '../../shared/attendance';
import {formWhatsappChoice} from './consent';
import schema from '../../shared/anamnese.schema.json';

describe('Operational attendance and post-care anchor',()=>{
  it('separates presence from the beginning and completion of a session',()=>{
    const present=transitionAttendance(emptyAttendance,'present');
    expect(present).toEqual({attendance:'present',session:'not_started',needsMore:false});
    const started=transitionAttendance(present,'start');
    expect(started.session).toBe('in_progress');
    expect(transitionAttendance(started,'needs_more')).toEqual({attendance:'present',session:'completed',needsMore:true});
  });
  it('accepts checking in and starting at once',()=>{expect(transitionAttendance(emptyAttendance,'start')).toEqual({attendance:'present',session:'in_progress',needsMore:false});});
  it('does not treat a delay as presence or a performed session',()=>{expect(transitionAttendance(emptyAttendance,'late')).toEqual({attendance:'late',session:'not_started',needsMore:false});});
  it('a no-show can be corrected explicitly to presence',()=>{expect(transitionAttendance(transitionAttendance(emptyAttendance,'no_show'),'present').attendance).toBe('present');});
  it('rejects a no-show after a check-in or session start',()=>{for(const action of ['present','start'] as const)expect(()=>transitionAttendance(transitionAttendance(emptyAttendance,action),'no_show')).toThrow();});
  it('does not finish a no-show without first correcting the presence',()=>{expect(()=>transitionAttendance(transitionAttendance(emptyAttendance,'no_show'),'finish')).toThrow();});
  it('repeated finishing is idempotent and a completed session cannot regress',()=>{const finished=transitionAttendance(emptyAttendance,'finish');expect(transitionAttendance(finished,'finish')).toBe(finished);expect(()=>transitionAttendance(finished,'start')).toThrow();});
  it('normalizes the automatic tag without allowing a different capitalization to forge it',()=>{expect(isNoShowTag(' NÃO   COMPARECEU ')).toBe(true);expect(isNoShowTag('compareceu')).toBe(false);});
});
describe('Scheduling in the studio timezone',()=>{
  const base={date:'2026-10-20 23:30:00',duration:90,activatedAt:'2026-10-19 21:00:00',state:emptyAttendance};
  it('keeps the studio day when the server is already on the following day',()=>{expect(attendanceClock(new Date('2026-10-21T02:30:00Z'))).toBe('2026-10-20 23:30:00');});
  it('does not send before the appointment',()=>{expect(attendanceSlot({...base,now:'2026-10-20 23:29:59'})).toBeNull();});
  it('sends the arrival question at the appointment time',()=>{expect(attendanceSlot({...base,now:base.date})).toBe('start');});
  it('handles a session ending after midnight',()=>{expect(attendanceSlot({...base,now:'2026-10-21 01:00:00'})).toBe('end');});
  it('recovers a delayed end question without sending an obsolete arrival question',()=>{expect(attendanceSlot({...base,now:'2026-10-21 09:00:00'})).toBe('end');});
  it('does not retrospectively notify appointments that began before activation',()=>{expect(attendanceSlot({...base,activatedAt:'2026-10-21 00:00:00',now:'2026-10-21 01:00:00'})).toBeNull();});
  it('does not notify old, absent or completed appointments',()=>{
    expect(attendanceSlot({...base,now:'2026-10-22 01:00:00'})).toBeNull();
    for(const action of ['no_show','finish'] as const)expect(attendanceSlot({...base,now:base.date,state:transitionAttendance(emptyAttendance,action)})).toBeNull();
  });
  it('presence stops the arrival message and preserves the end question',()=>{
    const state=transitionAttendance(emptyAttendance,'present');
    expect(attendanceSlot({...base,state,now:base.date})).toBeNull();
    expect(attendanceSlot({...base,state,now:'2026-10-21 01:00:00'})).toBe('end');
  });
});
describe('Explicit permission on the customer form',()=>{
  it('birthdate and old general terms never authorize WhatsApp',()=>{expect(formWhatsappChoice({client_dob:'1990-10-20',consent_terms:true})).toBeNull();});
  it('accepts only explicit booleans and preserves refusal',()=>{expect(formWhatsappChoice({whatsapp_updates:true})).toBe(true);expect(formWhatsappChoice({whatsapp_updates:false})).toBe(false);expect(formWhatsappChoice({whatsapp_updates:'true'})).toBeNull();});
  it('the messaging choice is separate, optional and states the purpose',()=>{const field=schema.steps.flatMap(s=>s.fields).find(f=>f.key==='whatsapp_updates')!;expect(field.required).toBe(false);expect(field.label).toMatch(/aniversário/);expect(field.label).toMatch(/após o atendimento/);});
});
