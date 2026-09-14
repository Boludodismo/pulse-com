import {afterEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({connect:vi.fn()}));
vi.mock('mysql2/promise',()=>({default:{createConnection:m.connect}}));
import {ensureStagingArtistInvitationSchema} from './_core/stagingArtistInvitationSchema';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it('aplica somente a extensão de convite e permite reiniciar sem duplicar colunas',async()=>{
 vi.stubEnv('RAILWAY_ENVIRONMENT_ID','92e8281a-668a-43ed-b2ba-cac84082a91c');vi.stubEnv('RAILWAY_SERVICE_ID','7527417a-b872-42bf-b828-e0987b805196');vi.stubEnv('RUN_DB_MIGRATIONS','true');
 const columns=new Set<string>();const queries:string[]=[];
 m.connect.mockResolvedValue({end:vi.fn(),query:vi.fn(async(q:string,args?:string[])=>{queries.push(q);if(q.startsWith('SHOW COLUMNS'))return [columns.has(args![0])?[{Field:args![0]}]:[]];if(q.startsWith('ALTER TABLE'))columns.add(q.match(/ADD COLUMN `([^`]+)`/)![1]);return [[{acquired:1}]];})});
 await ensureStagingArtistInvitationSchema();await ensureStagingArtistInvitationSchema();expect(columns).toEqual(new Set(['artistId','permissionSnapshot']));expect(queries.filter(q=>q.startsWith('ALTER TABLE'))).toHaveLength(2);expect(queries.join('\n')).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE)\b/i);
});
it('não altera produção nem outro serviço',async()=>{vi.stubEnv('RAILWAY_ENVIRONMENT_ID','production');await ensureStagingArtistInvitationSchema();expect(m.connect).not.toHaveBeenCalled();});
