import {beforeEach,describe,expect,it,vi} from 'vitest';
import {MySqlDialect} from 'drizzle-orm/mysql-core';
const mock=vi.hoisted(()=>({select:vi.fn(),update:vi.fn(),delete:vi.fn(),conditions:[] as any[]}));
vi.mock('drizzle-orm/mysql2',()=>({drizzle:()=>mock}));
import {appRouter} from './routers';
beforeEach(()=>{
 vi.stubEnv('DATABASE_URL','mysql://test.invalid/test');mock.conditions=[];
 const where=(c:any)=>{mock.conditions.push(new MySqlDialect().sqlToQuery(c));};
 mock.select.mockImplementation(()=>{const q:any={from:()=>q,leftJoin:()=>q,innerJoin:()=>q,where:(c:any)=>{where(c);return q;},orderBy:()=>q,limit:()=>q,then:(r:any)=>Promise.resolve([]).then(r)};return q;});
 mock.update.mockImplementation(()=>({set:()=>({where:async(c:any)=>{where(c);return [{affectedRows:0}];}})}));
 mock.delete.mockImplementation(()=>({where:async(c:any)=>{where(c);return [{affectedRows:0}];}}));
});
function caller(studioId:number|null){return appRouter.createCaller({user:{id:1,openId:'pilot:test',role:'admin',studioId,isActive:1,accessStatus:'active'},req:{headers:{}},res:{}} as any);}
describe('isolamento de notificações e lembretes',()=>{
 it.each([101,202])('filtra histórico e lembretes do estúdio %i',async id=>{
  const api=caller(id);
  await expect(api.notifications.getNotificationLogs({limit:50})).resolves.toEqual([]);
  await expect(api.notifications.getWhatsAppLogs({limit:50})).resolves.toEqual([]);
  await expect(api.notifications.getPendingReminders()).resolves.toEqual([]);
  expect(mock.conditions).toHaveLength(3);
  for(const q of mock.conditions){expect(q.sql).toContain('studioId');expect(q.params).toContain(id);expect(q.params).not.toContain(id===101?202:101);}
  expect(mock.conditions[0].sql).toContain('IS NULL');
 });
 it('não edita, exclui ou libera lembrete de outra empresa por ID',async()=>{
  const api=caller(202);
  await expect(api.notifications.updateReminder({id:999,scheduledAt:'2099-01-01 10:00:00'})).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(api.notifications.deleteReminder({id:999})).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(api.notifications.sendPendingReminderNow({id:999})).rejects.toMatchObject({code:'NOT_FOUND'});
  for(const q of mock.conditions){expect(q.params).toContain(202);expect(q.sql).toContain('studioId');}
  expect(mock.conditions[0].sql).toContain('EXISTS');expect(mock.conditions[1].sql).toContain('EXISTS');
 });
 it('protege também as rotas de edição/exclusão do modal de agenda',async()=>{
  const api=caller(202);
  await expect(api.appointments.reminders.update({id:999,message:'teste'})).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(api.appointments.reminders.delete({id:999})).rejects.toMatchObject({code:'NOT_FOUND'});
  expect(mock.conditions.every(q=>q.params.includes(202))).toBe(true);
 });
 it('bloqueia operação global de envio e esconde status global do scheduler',async()=>{
  await expect(caller(202).notifications.sendReminders()).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(caller(202).notifications.getWhatsAppSchedulerStatus()).resolves.toBeNull();
  expect(mock.conditions).toEqual([]);
 });
 it('recusa sessão sem empresa antes da consulta',async()=>{
  await expect(caller(null).notifications.getNotificationLogs({})).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(caller(null).notifications.getPendingReminders()).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(mock.conditions).toEqual([]);
 });
});
