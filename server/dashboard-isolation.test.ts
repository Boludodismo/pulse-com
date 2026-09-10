import {beforeEach,describe,expect,it,vi} from 'vitest';
import {MySqlDialect} from 'drizzle-orm/mysql-core';
const mock=vi.hoisted(()=>({select:vi.fn(),conditions:[] as any[],joins:[] as any[]}));
vi.mock('drizzle-orm/mysql2',()=>({drizzle:()=>({select:mock.select})}));
import * as db from './db';
import {appRouter} from './routers';

beforeEach(()=>{
  vi.stubEnv('DATABASE_URL','mysql://test.invalid/test');
  mock.conditions=[];mock.joins=[];
  mock.select.mockImplementation(()=>{
    const q:any={from:()=>q,where:(c:any)=>{mock.conditions.push(new MySqlDialect().sqlToQuery(c));return q;},leftJoin:(_:any,c:any)=>{mock.joins.push(new MySqlDialect().sqlToQuery(c));return q;},orderBy:()=>q,limit:()=>q,then:(resolve:any)=>Promise.resolve([]).then(resolve)};
    return q;
  });
});
function caller(studioId:number|null){return appRouter.createCaller({user:{id:1,openId:'pilot:test',name:'Teste',email:'test@example.test',role:'admin',studioId,isActive:1,accessStatus:'active'},req:{headers:{}},res:{}} as any);}
describe('isolamento do dashboard',()=>{
  it.each([101,202])('aplica o estúdio %i em todas as consultas reais do dashboard',async studioId=>{
    const api=caller(studioId);
    await expect(api.dashboard.metrics()).resolves.toEqual({totalClients:0,totalAppointments:0,totalRevenue:0,upcomingBirthdaysCount:0});
    await expect(api.dashboard.topClients({limit:5})).resolves.toEqual([]);
    await expect(api.dashboard.upcomingBirthdays({daysAhead:30})).resolves.toEqual([]);
    await expect(api.dashboard.weeklyAppointments()).resolves.toEqual([]);
    expect(mock.conditions).toHaveLength(7);
    for(const query of mock.conditions){expect(query.sql).toContain('studioId');expect(query.params).toContain(studioId);expect(query.params).not.toContain(studioId===101?202:101);}
    expect(mock.joins[0].sql).toContain('studioId');expect(mock.joins[0].params).toContain(studioId);
  });
  it('ignora tentativa de trocar a empresa pelo input',async()=>{
    await caller(202).dashboard.topClients({limit:5,studioId:101} as any);
    expect(mock.conditions[0].params).toContain(202);expect(mock.conditions[0].params).not.toContain(101);
  });
  it('bloqueia sessão sem estúdio em todos os endpoints',async()=>{
    const api=caller(null);
    for(const query of [api.dashboard.metrics(),api.dashboard.topClients({}),api.dashboard.upcomingBirthdays({}),api.dashboard.weeklyAppointments()])await expect(query).rejects.toMatchObject({code:'FORBIDDEN'});
    expect(mock.conditions).toEqual([]);
  });
  it('helpers não aceitam escopo omitido ou inválido',async()=>{
    await expect(db.getDashboardMetrics(undefined as any)).rejects.toThrow();
    await expect(db.getTopClients(5,0)).rejects.toThrow();
    await expect(db.getWeeklyAppointments(-1)).rejects.toThrow();
    await expect(db.getUpcomingBirthdays(30,undefined as any)).rejects.toThrow();
    expect(mock.conditions).toEqual([]);
  });
});
