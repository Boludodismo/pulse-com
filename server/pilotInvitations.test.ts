import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({getDb:vi.fn(),hash:vi.fn(async()=> 'bcrypt-test-hash')}));
vi.mock('./db',()=>({getDb:mock.getDb}));
vi.mock('./_core/localAuth',()=>({hashPassword:mock.hash}));
import {assertPilotPending,issuePilotInvitation,registerPilot,pilotRegistration} from './pilotInvitations';
import {claimStudioInvitation} from './saas';
import {users,studios,studioInvitations,calendars} from '../drizzle/schema';
const invitation={id:9,studioId:10,artistId:null,email:'pilot@example.test',role:'admin',status:'pending',expiresAt:'2099-01-01 00:00:00',tokenHash:'pilot:hash'};
const input={token:'a'.repeat(64),name:'Teste',email:'pilot@example.test',studioName:'Estúdio teste',password:'SenhaSomenteTeste123'};
function database(results:any[][]){
 const writes:any[]=[];const locks=vi.fn();const db:any={};
 db.select=vi.fn(()=>{const rows=results.shift()??[];const q:any={then:(r:any)=>Promise.resolve(rows).then(r)};for(const name of ['from','where','limit'])q[name]=()=>q;q.for=()=>{locks();return q;};return q;});
 db.insert=vi.fn((table:any)=>({values:async(value:any)=>{writes.push({table,value,insert:true});return [{insertId:55}];}}));
 db.update=vi.fn((table:any)=>({set:(value:any)=>({where:async()=>{writes.push({table,value,insert:false});return [{affectedRows:1}];}})}));
 db.transaction=vi.fn(async(fn:any)=>fn(db));mock.getDb.mockResolvedValue(db);return {db,writes,locks};
}
beforeEach(()=>vi.clearAllMocks());
describe('piloto SaaS por convite',()=>{
 it.each(['accepted','revoked','expired'])('rejeita convite %s',status=>expect(()=>assertPilotPending({...invitation,status})).toThrow());
 it('rejeita token legado, artista, prazo expirado e data inválida',()=>{
   for(const change of [{tokenHash:'legacy'},{artistId:1},{expiresAt:'2000-01-01 00:00:00'},{expiresAt:'invalid'}])expect(()=>assertPilotPending({...invitation,...change})).toThrow();
 });
 it('cria estúdio separado e guarda somente hash do token',async()=>{
   const {writes,db}=database([[],[]]);const result=await issuePilotInvitation({email:input.email,studioName:input.studioName,invitedByUserId:1});
   expect(db.transaction).toHaveBeenCalledOnce();expect(writes[0].table).toBe(studios);expect(writes[1].table).toBe(studioInvitations);
   expect(writes[1].value.studioId).toBe(55);expect(writes[1].value.tokenHash).toMatch(/^pilot:[a-f0-9]{64}$/);expect(writes[1].value.tokenHash).not.toContain(result.token);
 });
 it('recusa e-mail existente antes de criar estúdio',async()=>{
   const {writes}=database([[{id:1}]]);await expect(issuePilotInvitation({email:input.email,studioName:input.studioName,invitedByUserId:1})).rejects.toThrow('já possui');expect(writes).toEqual([]);
 });
 it('não repete um convite piloto pendente',async()=>{
   const {writes}=database([[],[{id:1}]]);await expect(issuePilotInvitation({email:input.email,studioName:input.studioName,invitedByUserId:1})).rejects.toThrow('pendente');expect(writes).toEqual([]);
 });
 it('cadastra admin e calendário no estúdio do convite sem alterar contas',async()=>{
   const {writes,locks}=database([[invitation],[{name:'Teste',isActive:1}],[invitation],[{isActive:1}],[]]);
   await expect(registerPilot(input)).resolves.toEqual({success:true});expect(locks).toHaveBeenCalledTimes(2);
   const account=writes.find(w=>w.table===users);expect(account.insert).toBe(true);expect(account.value).toMatchObject({studioId:10,role:'admin',accessExpiresAt:null,passwordHash:'bcrypt-test-hash'});
   expect(writes.find(w=>w.table===calendars).value.userId).toBe(55);expect(writes.find(w=>w.table===studioInvitations).value.status).toBe('accepted');
 });
 it('recusa e-mail divergente e conta existente sem escritas',async()=>{
   let d=database([[invitation],[{name:'Teste',isActive:1}],[invitation]]);await expect(registerPilot({...input,email:'other@example.test'})).rejects.toThrow('e-mail');expect(d.writes).toEqual([]);
   d=database([[invitation],[{name:'Teste',isActive:1}],[invitation],[{isActive:1}],[{id:1}]]);await expect(registerPilot(input)).rejects.toThrow('Nenhuma conta');expect(d.writes).toEqual([]);
 });
 it('revalida revogação após hash e antes de escrever',async()=>{
   const {writes}=database([[invitation],[{name:'Teste',isActive:1}],[{...invitation,status:'revoked'}]]);await expect(registerPilot(input)).rejects.toThrow();expect(writes).toEqual([]);
 });
 it.each([{role:'superadmin',studioId:10},{role:'admin',studioId:99}])('convite legado não reassocia conta protegida %j',async user=>{
   const {writes}=database([[invitation],[{...user,email:input.email,id:1}]]);expect((await claimStudioInvitation(input.token,1)).ok).toBe(false);expect(writes).toEqual([]);
 });
 it('valida senha antes do banco',()=>{expect(pilotRegistration.safeParse({...input,password:'123'}).success).toBe(false);expect(pilotRegistration.safeParse({...input,password:'á'.repeat(40)}).success).toBe(false);});
});
