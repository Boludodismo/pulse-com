import {beforeEach,afterAll,describe,expect,it,vi} from 'vitest';
import {getTableName} from 'drizzle-orm';
const m=vi.hoisted(()=>({db:{select:vi.fn(),update:vi.fn(),transaction:vi.fn()},before:{} as any,record:[] as any[],writes:[] as any[]}));
vi.mock('drizzle-orm/mysql2',()=>({drizzle:()=>m.db}));
import {updateAppointment} from './db';
import {appointmentHasHistory,changesAppointmentSlot} from '../shared/appointmentHistory';

beforeEach(()=>{
  vi.stubEnv('DATABASE_URL','mysql://test:test@localhost/test');vi.clearAllMocks();m.writes=[];m.record=[];
  m.before={id:55,studioId:1,clientId:3,artistId:7,artist:'Ana',date:'2026-10-19 14:00:00',duration:60,calendarId:9,status:'agendado'};
  m.db.transaction.mockImplementation(async fn=>fn(m.db));
  m.db.select.mockImplementation(()=>{let table='';const q:any={from:(t:any)=>{table=getTableName(t);return q;},where:()=>q,limit:()=>q,for:()=>q,leftJoin:()=>q,then:(resolve:any,reject:any)=>Promise.resolve(table==='studios'?[{id:1}]:table==='appointments'?[m.before]:m.record).then(resolve,reject)};return q;});
  m.db.update.mockImplementation(()=>({set:(data:any)=>({where:async()=>{m.writes.push(data);}})}));
});
afterAll(()=>vi.unstubAllEnvs());
describe('Appointment history remains on its original day',()=>{
  it('rejects moving a checked-in appointment through the normal edit endpoint',async()=>{m.record=[{attendance:'present'}];await expect(updateAppointment(55,{date:'2026-10-26 15:00:00'})).rejects.toMatchObject({code:'BAD_REQUEST',message:expect.stringContaining('histórico')});expect(m.writes).toEqual([]);});
  it('preserves the calendar and duration of completed or absent appointments',async()=>{
    for(const patch of [{duration:90},{calendarId:10}]){m.record=[{attendance:'no_show'}];await expect(updateAppointment(55,patch)).rejects.toMatchObject({code:'BAD_REQUEST'});}
    m.record=[];m.before.status='concluido';await expect(updateAppointment(55,{date:'2026-10-26 15:00:00'})).rejects.toMatchObject({code:'BAD_REQUEST'});expect(m.writes).toEqual([]);
  });
  it('allows correcting notes or financial data without moving the historical slot',async()=>{m.record=[{attendance:'present'}];await updateAppointment(55,{clientId:3,artistId:7,artist:'Ana',date:m.before.date,duration:60,calendarId:9,notes:'Conferência posterior',totalAmount:50000});expect(m.writes).toHaveLength(1);expect(m.writes[0].date).toBe('2026-10-19 14:00:00');});
  it('keeps genuine rescheduling available before attendance has been recorded',async()=>{await updateAppointment(55,{date:'2026-10-26 15:00:00'});expect(m.writes).toEqual([{date:'2026-10-26 15:00:00'}]);});
  it('recognizes the same displayed time and a missing optional calendar as unchanged',()=>{expect(changesAppointmentSlot({...m.before,calendarId:null},{date:'2026-10-19T14:00:00Z',calendarId:null})).toBe(false);});
  it('a future client RSVP alone does not lock the slot; operational presence does',()=>{expect(appointmentHasHistory({status:'confirmado'})).toBe(false);expect(appointmentHasHistory({status:'agendado',attendanceStatus:'present'})).toBe(true);expect(appointmentHasHistory({status:'concluido'})).toBe(true);});
});
