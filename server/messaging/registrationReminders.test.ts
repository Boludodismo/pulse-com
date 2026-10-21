import {beforeEach,describe,expect,it,vi} from 'vitest';
import {getTableName} from 'drizzle-orm';
const mock=vi.hoisted(()=>({getDb:vi.fn(),consent:vi.fn(),send:vi.fn(),links:vi.fn()}));
vi.mock('../db',()=>({getDb:mock.getDb}));
vi.mock('../attendance/consent',()=>({ensureCareWhatsappConsent:mock.consent}));
vi.mock('./service',()=>({sendAndLog:mock.send,dispatchTemplateMessage:vi.fn()}));
vi.mock('../appointmentActions',()=>({issueAppointmentActionLinks:mock.links,formatAppointmentActionLinks:()=> 'links de confirmação'}));
import {enqueueDueIndividualReminders} from './automaticReminders';
let data:Record<string,unknown[]>;
beforeEach(()=>{
 vi.clearAllMocks();
 data={appointmentReminders:[{id:4,appointmentId:5,clientId:3,studioId:2,clientName:'Teste',clientPhone:'+5531999998888',message:'Lembrete'}],whatsapp_integrations:[{id:19}],integration_jobs:[]};
 mock.getDb.mockResolvedValue({select:()=>{let table='';const q:any={from:(t:any)=>{table=getTableName(t);return q;},leftJoin:()=>q,where:()=>q,limit:()=>q,then:(resolve:any,reject:any)=>Promise.resolve(data[table]??[]).then(resolve,reject)};return q;}});
 mock.consent.mockResolvedValue(true);mock.send.mockResolvedValue({success:true,queued:true});mock.links.mockResolvedValue({});
});
describe('Individual reminders from registered client preferences',()=>{
 it('reconciles durable permission before queuing a reminder',async()=>{
  expect(await enqueueDueIndividualReminders()).toEqual({queued:1,skipped:0});
  expect(mock.consent).toHaveBeenCalledWith(2,19,3);
  expect(mock.send).toHaveBeenCalledWith(expect.objectContaining({studioId:2,integrationId:19,clientId:3,appointmentReminderId:4,trigger:'scheduled_reminder'}));
  expect(mock.consent.mock.invocationCallOrder[0]).toBeLessThan(mock.send.mock.invocationCallOrder[0]);
 });
 it('does not queue for a refused, revoked or changed-phone permission',async()=>{
  mock.consent.mockResolvedValue(false);
  expect(await enqueueDueIndividualReminders()).toEqual({queued:0,skipped:1});
  expect(mock.send).not.toHaveBeenCalled();
 });
 it('does not duplicate an already queued reminder',async()=>{
  data.integration_jobs=[{id:7}];
  expect(await enqueueDueIndividualReminders()).toEqual({queued:0,skipped:0});
  expect(mock.send).not.toHaveBeenCalled();
 });
});
