import {it,expect,vi,afterEach} from 'vitest';
const m=vi.hoisted(()=>({connect:vi.fn()}));
vi.mock('mysql2/promise',()=>({default:{createConnection:m.connect}}));
import {ensureStagingIntelligentInboxSchema} from './_core/stagingIntelligentInboxSchema';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it('restaura RBAC ausente antes de consultar ou ampliar o enum, sem conceder direitos',async()=>{
 vi.stubEnv('RAILWAY_ENVIRONMENT_ID','92e8281a-668a-43ed-b2ba-cac84082a91c');vi.stubEnv('RAILWAY_SERVICE_ID','7527417a-b872-42bf-b828-e0987b805196');vi.stubEnv('RUN_DB_MIGRATIONS','true');
 let exists=false;const queries:string[]=[];
 const query=vi.fn(async(sql:string)=>{queries.push(sql);if(sql.startsWith('CREATE TABLE IF NOT EXISTS `user_module_permissions`'))exists=true;if(sql.startsWith('SHOW COLUMNS')){if(!exists)throw new Error('Table missing');return [[{Type:"enum('clients','appointments','stock','finance','anamnesis','pod','reports','intelligent_inbox','inbox_conversations','inbox_summaries','inbox_priorities','inbox_opportunities','inbox_settings','inbox_suggestions')"}]];}return [[{acquired:1}]];});
 m.connect.mockResolvedValue({query,end:vi.fn()});await ensureStagingIntelligentInboxSchema();expect(exists).toBe(true);expect(queries.join('\n')).not.toMatch(/\b(INSERT|DELETE|TRUNCATE|DROP)\b/i);expect(queries.filter(q=>q.startsWith('CREATE TABLE IF NOT EXISTS inbox_'))).toHaveLength(4);
});
it('não toca nenhum banco fora do ambiente de homologação autorizado',async()=>{vi.stubEnv('RAILWAY_ENVIRONMENT_ID','production');await ensureStagingIntelligentInboxSchema();expect(m.connect).not.toHaveBeenCalled();});
