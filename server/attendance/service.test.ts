import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({database:vi.fn(),send:vi.fn(),artist:vi.fn()}));
vi.mock('../commitments/db',()=>({database:mock.database}));
vi.mock('../messaging/service',()=>({sendAndLog:mock.send}));
vi.mock('../messaging/artistNotifications',()=>({queueArtistOperationalNotice:mock.artist}));
import {applyAttendance,attendanceFingerprint,publicAttendanceView,runAttendanceCycle} from './service';

let a:any,record:any,care:any[],events:any[],sqlCalls:string[],pool:any,connection:any;
beforeEach(()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-20T17:00:00Z'));vi.clearAllMocks();
  a={id:14,studioId:2,clientId:3,artistId:7,artist:'Ana',clientName:'Maria Teste',date:'2026-10-20 14:00:00',duration:60,status:'agendado',attendanceEnabled:1,attendanceRecipient:'artist'};
  record=undefined;care=[];events=[];sqlCalls=[];
  connection={beginTransaction:vi.fn(),commit:vi.fn(),rollback:vi.fn(),release:vi.fn(),query:vi.fn(async(sql:string,params:any[]=[])=>{
    sqlCalls.push(sql);
    if(sql.startsWith('SELECT * FROM appointments'))return [[a]];
    if(sql.startsWith('SELECT id FROM clients'))return [[{id:3}]];
    if(sql.startsWith('SELECT timezone'))return [[{timezone:'America/Sao_Paulo'}]];
    if(sql.startsWith('SELECT * FROM appointment_attendance'))return [[...(record?[record]:[])]];
    if(sql.startsWith('INSERT INTO appointment_attendance(')){record={client_id:params[2],artist_id:params[3],attendance:params[4],session:params[5],needs_more:params[6],present_at:params[7],started_at:params[8],finished_at:params[9],revision:(record?.revision??0)+1};}
    if(sql.startsWith('INSERT INTO appointment_attendance_events'))events.push(params);
    if(sql.startsWith('INSERT INTO care_sessions')&&!care.length)care.push(params);
    if(sql.startsWith('SELECT COUNT(*)'))return [[{total:record?.attendance==='no_show'?1:0}]];
    return [{affectedRows:1}];
  })};
  pool={getConnection:vi.fn(async()=>connection),query:vi.fn()};mock.database.mockReturnValue(pool);
  mock.send.mockResolvedValue({success:true,queued:true});mock.artist.mockImplementation(async(input:any)=>{if(typeof input.message==='function')await input.message();return true;});
});
afterEach(()=>vi.useRealTimers());
const act=(action:any,revision=0,extra={})=>applyAttendance({appointmentId:14,studioId:2,action,revision,source:'test',...extra});
describe('Transactional operational recording',()=>{
  it('presence anchors post-care immediately without recording material consumption',async()=>{await act('present');expect(record.attendance).toBe('present');expect(record.session).toBe('not_started');expect(care).toHaveLength(1);expect(care[0].slice(0,5)).toEqual([2,3,7,14,'appointment:14']);expect(sqlCalls.join('\n')).not.toMatch(/inventory|consumptions|stock_movements/);expect(connection.commit).toHaveBeenCalledOnce();});
  it('later completion and repeated clicks keep one post-care anchor',async()=>{await act('present');const anchor=care[0][5];await act('start',1);await act('finish',2);expect(await act('finish',2)).toEqual({ok:true,duplicate:true});expect(care).toHaveLength(1);expect(care[0][5]).toBe(anchor);expect(events).toHaveLength(3);expect(sqlCalls.join('\n')).toContain("status='concluido'");});
  it('a repeated no-show creates one occurrence and no post-care anchor',async()=>{await act('no_show');expect(await act('no_show')).toEqual({ok:true,duplicate:true});expect(events).toHaveLength(1);expect(care).toHaveLength(0);expect(sqlCalls.join('\n')).toContain('INSERT INTO care_tags');});
  it('correcting a no-show checks in the customer and repairs the automatic tag',async()=>{await act('no_show');await act('present',1);expect(record.attendance).toBe('present');expect(care).toHaveLength(1);expect(sqlCalls.join('\n')).toContain('DELETE FROM care_tags');});
  it('rejects a stale update instead of overwriting another action',async()=>{await act('late');await expect(act('no_show')).rejects.toMatchObject({code:'CONFLICT'});expect(events).toHaveLength(1);expect(connection.rollback).toHaveBeenCalledOnce();});
  it('rejects a changed recipient, cancellation, future-day check-in or reassignment',async()=>{
    await expect(act('present',0,{fingerprint:'f'.repeat(64)})).rejects.toThrow();
    await expect(act('present',0,{actorArtistId:99})).rejects.toThrow();
    a.status='cancelado';await expect(act('present')).rejects.toThrow();a.status='agendado';
    a.date='2026-10-21 10:00:00';await expect(act('present')).rejects.toThrow(/dia agendado/);
    expect(events).toHaveLength(0);
  });
  it('rolls back when recording the event fails',async()=>{const original=connection.query.getMockImplementation()!;connection.query.mockImplementation(async(sql:string,p:any[])=>{if(sql.startsWith('INSERT INTO appointment_attendance_events'))throw Error('write failed');return original(sql,p);});await expect(act('present')).rejects.toThrow('write failed');expect(connection.rollback).toHaveBeenCalledOnce();expect(connection.commit).not.toHaveBeenCalled();expect(care).toHaveLength(0);});
  it('changing date, duration, customer, artist or notice settings invalidates the fingerprint',()=>{const key=attendanceFingerprint(a);for(const delta of [{date:'2026-10-21 14:00:00'},{duration:90},{clientId:99},{artistId:9},{attendanceRecipient:'studio'},{attendanceEnabled:0}])expect(attendanceFingerprint({...a,...delta})).not.toBe(key);expect(attendanceFingerprint({...a,notes:'changed'})).toBe(key);});
});
describe('Public capabilities and scheduler routing',()=>{
  it('opening a public link is read-only and exposes no customer phone or full name',async()=>{
    pool.query.mockImplementation(async(sql:string)=>{
      if(sql.includes('appointment_attendance_links'))return [[{appointment_id:14,studio_id:2,fingerprint:attendanceFingerprint(a)}]];
      if(sql.startsWith('SELECT a.*'))return [[{...a,phone:'private',clientName:'Maria Teste'}]];
      return [[]];
    });
    const data=await publicAttendanceView('a'.repeat(64));expect(data.clientName).toBe('Maria');expect(data).not.toHaveProperty('clientId');expect(data).not.toHaveProperty('phone');expect(pool.query.mock.calls.every(([sql]:any)=>sql.startsWith('SELECT'))).toBe(true);expect(pool.getConnection).not.toHaveBeenCalled();
  });
  it('rejects expired or changed public capabilities',async()=>{pool.query.mockResolvedValue([[]]);await expect(publicAttendanceView('a'.repeat(64))).rejects.toMatchObject({code:'NOT_FOUND'});});
  function schedulerData(studio=false){
    a.attendanceRecipient=studio?'studio':'artist';
    pool.query.mockImplementation(async(sql:string)=>{
      if(sql.includes('attendance_runtime'))return [[{activated_at:'2026-10-20 00:00:00'}]];
      if(sql.includes('a.attendanceEnabled=1'))return [[a]];
      if(sql.startsWith('SELECT a.*'))return [[a]];
      if(sql.includes('appointment_attendance WHERE'))return [[]];
      if(sql.includes('studioSettings'))return [[{phone:'(31) 99999-8888'}]];
      if(sql.includes('whatsapp_integrations w'))return [[{id:19}]];
      return [[]];
    });
  }
  it('routes a due arrival question to the assigned artist only',async()=>{schedulerData();await runAttendanceCycle();expect(mock.artist).toHaveBeenCalledWith(expect.objectContaining({studioId:2,artistId:7,appointmentId:14,message:expect.any(Function)}));expect(await mock.artist.mock.calls[0][0].message()).toContain('Maria');expect(mock.send).not.toHaveBeenCalled();});
  it('routes the studio choice to the studio phone through the studio integration',async()=>{schedulerData(true);await runAttendanceCycle();expect(mock.send).toHaveBeenCalledWith(expect.objectContaining({operationalRecipient:'studio',integrationId:19,recipientPhone:'+5531999998888',appointmentId:14}));expect(mock.artist).not.toHaveBeenCalled();});
  it('does not duplicate an already queued slot',async()=>{schedulerData();const original=pool.query.getMockImplementation()!;pool.query.mockImplementation((sql:string,p:any[])=>sql.includes('FROM integration_jobs')?Promise.resolve([[{id:42}]]):original(sql,p));await runAttendanceCycle();expect(mock.artist).not.toHaveBeenCalled();expect(pool.query.mock.calls.some(([sql]:any)=>sql.startsWith('INSERT INTO appointment_attendance_links'))).toBe(false);});
});
