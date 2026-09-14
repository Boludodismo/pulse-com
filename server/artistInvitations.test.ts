import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({getDb:vi.fn(),hash:vi.fn(async()=> 'bcrypt-test-hash'),permissions:vi.fn()}));
vi.mock('./db',()=>({getDb:mock.getDb}));
vi.mock('./_core/localAuth',()=>({hashPassword:mock.hash}));
vi.mock('./saas',async original=>({...await original<any>(),hasModulePermission:mock.permissions}));
import {pendingInvitation,permissionInput,invitationPassword,tokenHash,issueArtistInvitation,registerInvitedArtist} from './artistInvitations';
import {assertInvitedArtistAccess,invitedRoutePermission} from './invitedArtistAccess';
import {artistRouteModule,isInvitedArtist} from '../shared/artistInvitations';
import {users,studioInvitations,userModulePermissions} from '../drizzle/schema';
const user={id:5,openId:'artist-invite:abc',role:'collaborator',studioId:10,artistId:7};
const invitation={id:9,studioId:10,artistId:7,email:'artist@example.test',role:'collaborator',status:'pending',expiresAt:'2099-01-01 00:00:00',permissionSnapshot:[{module:'clients',canRead:true,canWrite:false}]};
/** Scripted DB records: checks service branches; not a substitute for MySQL E2E. */
function database(results:any[][]){
 const writes:any[]=[];const locks=vi.fn();
 const db:any={};
 db.select=vi.fn(()=>{const rows=results.shift()??[];const q:any={then:(r:any)=>Promise.resolve(rows).then(r)};for(const name of ['from','where','limit','orderBy'])q[name]=()=>q;q.for=()=>{locks();return q;};return q;});
 db.insert=vi.fn((table:any)=>({values:(value:any)=>{writes.push({table,value});return Promise.resolve([{insertId:55}]);}}));
 db.update=vi.fn((table:any)=>({set:(value:any)=>({where:async()=>{writes.push({table,value});return [{affectedRows:1}];}})}));
 db.transaction=vi.fn(async(fn:any)=>fn(db));mock.getDb.mockResolvedValue(db);return{db,writes,locks};
}
beforeEach(()=>{vi.clearAllMocks();mock.permissions.mockResolvedValue(false);});
describe('convite seguro de artista',()=>{
 it('considera a validade em UTC, inclusive ao atravessar a meia-noite',()=>{expect(pendingInvitation({...invitation,expiresAt:'2026-09-09 00:30:00'},Date.parse('2026-09-09T00:29:59Z'))).toBe(true);expect(pendingInvitation({...invitation,expiresAt:'2026-09-09 00:30:00'},Date.parse('2026-09-09T00:30:00Z'))).toBe(false);});
 it.each(['accepted','revoked','expired'])('recusa convite %s',status=>expect(pendingInvitation({...invitation,status})).toBe(false));
 it('não usa convites legados para criar artista',()=>expect(pendingInvitation({...invitation,artistId:null})).toBe(false));
 it('recusa editar sem ver e módulos duplicados',()=>{expect(permissionInput.safeParse([{module:'clients',canRead:false,canWrite:true}]).success).toBe(false);expect(permissionInput.safeParse([...invitation.permissionSnapshot,...invitation.permissionSnapshot]).success).toBe(false);});
 it('recusa módulos arbitrários e senha curta ou truncada pelo bcrypt',()=>{expect(permissionInput.safeParse([{module:'superadmin',canRead:true,canWrite:true}]).success).toBe(false);expect(invitationPassword.safeParse('123').success).toBe(false);expect(invitationPassword.safeParse('á'.repeat(40)).success).toBe(false);});
 it('armazena hash em vez do token em texto',()=>expect(tokenHash('a'.repeat(64))).not.toBe('a'.repeat(64)));
 it('recusa artista de outro estúdio antes de escrever',async()=>{const{writes}=database([[]]);await expect(issueArtistInvitation({studioId:10,artistId:99,invitedByUserId:1,permissions:[]})).rejects.toThrow('Artista ativo');expect(writes).toEqual([]);});
 it('não substitui conta existente ao gerar convite',async()=>{const{writes}=database([[{id:7,active:1,email:'artist@example.test',phone:'31999999999'}],[{id:1}]]);await expect(issueArtistInvitation({studioId:10,artistId:7,invitedByUserId:1,permissions:[]})).rejects.toThrow('já possui');expect(writes).toEqual([]);});
 it('gera colaborador com snapshot, hash e prazo; revoga o link anterior',async()=>{const{writes}=database([[{id:7,name:'TESTE',active:1,email:'ARTIST@example.test',phone:'31999999999'}],[]]);const result=await issueArtistInvitation({studioId:10,artistId:7,invitedByUserId:1,permissions:[]});expect(result.token).toMatch(/^[a-f0-9]{64}$/);expect(writes[0].value.status).toBe('revoked');expect(writes[1].value).toMatchObject({role:'collaborator',studioId:10,artistId:7,email:'artist@example.test',permissionSnapshot:[],tokenHash:tokenHash(result.token)});expect(JSON.stringify(writes.map(w=>w.value))).not.toContain(result.token);});
 it('cria usuário, aplica permissões e consome convite na mesma transação',async()=>{const artist={id:7,name:'TESTE',active:1,email:'artist@example.test'};const{db,writes,locks}=database([[invitation],[artist],[{name:'Estúdio',isActive:1}],[invitation],[artist],[{isActive:1}],[]]);await registerInvitedArtist('a'.repeat(64),'SenhaSomenteTeste123');expect(db.transaction).toHaveBeenCalledOnce();expect(locks).toHaveBeenCalledTimes(2);expect(writes.find(w=>w.table===users).value).toMatchObject({role:'collaborator',studioId:10,artistId:7,passwordHash:'bcrypt-test-hash',accessExpiresAt:null});expect(writes.find(w=>w.table===userModulePermissions).value).toEqual([{userId:55,studioId:10,module:'clients',canRead:1,canWrite:0}]);expect(writes.find(w=>w.table===studioInvitations).value).toMatchObject({status:'accepted',acceptedUserId:55});});
 it('revalida uso único depois de adquirir lock',async()=>{const{writes}=database([[invitation],[{name:'TESTE',active:1}],[{name:'Estúdio',isActive:1}],[{...invitation,status:'accepted'}]]);await expect(registerInvitedArtist('a'.repeat(64),'SenhaSomenteTeste123')).rejects.toThrow('já utilizado');expect(writes).toEqual([]);});
 it('não redefine senha se o e-mail ganhou uma conta depois do convite',async()=>{const artist={id:7,name:'TESTE',active:1,email:'artist@example.test'};const{writes}=database([[invitation],[artist],[{name:'Estúdio',isActive:1}],[invitation],[artist],[{isActive:1}],[{id:1}]]);await expect(registerInvitedArtist('a'.repeat(64),'SenhaSomenteTeste123')).rejects.toThrow('Nenhuma senha');expect(writes).toEqual([]);});
});
describe('permissões reais dos novos artistas',()=>{
 it('preserva proprietário e superadmin',async()=>{await assertInvitedArtistAccess({...user,role:'superadmin'},'saas.studios','query',undefined);await assertInvitedArtistAccess({...user,role:'admin'},'users.create','mutation',{});expect(mock.permissions).not.toHaveBeenCalled();expect(mock.getDb).not.toHaveBeenCalled();});
 it('mantém contas legadas fora da nova política incremental',()=>expect(isInvitedArtist({...user,openId:'legacy-user'})).toBe(false));
 it.each(['users.setPassword','saas.claimInvitation','saas.setPermissions','search.global','dashboard.metrics','stock.listMaterials','unknown.futureRoute'])('bloqueia %s por padrão',async path=>{await expect(assertInvitedArtistAccess(user,path,'mutation',{})).rejects.toThrow('Seu acesso');expect(mock.getDb).not.toHaveBeenCalled();});
 it('verifica permissão de escrita no servidor',async()=>{await expect(assertInvitedArtistAccess(user,'clients.create','mutation',{})).rejects.toThrow('Seu acesso');expect(mock.permissions).toHaveBeenCalledWith({userId:5,studioId:10,module:'clients',write:true});});
 it('recusa troca de tenant mesmo com permissão',async()=>{mock.permissions.mockResolvedValue(true);await expect(assertInvitedArtistAccess(user,'clients.list','query',{studioId:99})).rejects.toThrow();});
 it('recusa cliente de outro tenant por ID direto',async()=>{mock.permissions.mockResolvedValue(true);database([[]]);await expect(assertInvitedArtistAccess(user,'clients.getById','query',{id:99})).rejects.toThrow();});
 it('permite leitura autorizada do cliente do estúdio',async()=>{mock.permissions.mockResolvedValue(true);database([[{id:99}]]);await expect(assertInvitedArtistAccess(user,'clients.getById','query',{id:99})).resolves.toBeUndefined();});
 it('nega avatar e agenda de outro artista',async()=>{database([]);await expect(assertInvitedArtistAccess(user,'artists.uploadAvatar','mutation',{artistId:77})).rejects.toThrow();mock.permissions.mockResolvedValue(true);database([[{studioId:10,artistId:77}]]);await expect(assertInvitedArtistAccess(user,'appointments.delete','mutation',{id:99})).rejects.toThrow();});
 it('rotas e menus não abrem administração pelo endereço',()=>{expect(artistRouteModule('/saas')).toBe(null);expect(artistRouteModule('/users')).toBe(null);expect(artistRouteModule('/stock')).toBe('stock');expect(invitedRoutePermission('studioRelations.saveCard')).toBe('self');});
});
