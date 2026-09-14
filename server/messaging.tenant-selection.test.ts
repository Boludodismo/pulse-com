import {beforeEach,expect,it,vi} from 'vitest';
import {MySqlDialect} from 'drizzle-orm/mysql-core';
const mocks=vi.hoisted(()=>({getDb:vi.fn()}));
vi.mock('./db',()=>({getDb:mocks.getDb}));
import {getActiveIntegration} from './messaging/service';
beforeEach(()=>vi.clearAllMocks());
it.each([undefined,null,0,-1,NaN])('não escolhe WhatsApp de outro estúdio quando tenant=%s',async studioId=>{expect(await getActiveIntegration(studioId)).toBe(null);expect(mocks.getDb).not.toHaveBeenCalled();});
it('exige estúdio, integração ativa e habilitada mesmo com ID explícito',async()=>{let captured:any;const query:any={from:()=>query,where:(condition:any)=>{captured=condition;return query;},limit:async()=>[]};mocks.getDb.mockResolvedValue({select:()=>query});expect(await getActiveIntegration(12,34)).toBe(null);const result=new MySqlDialect().sqlToQuery(captured);expect(result.sql).toContain('studio_id');expect(result.params).toEqual(['ativo',1,12,34]);});
