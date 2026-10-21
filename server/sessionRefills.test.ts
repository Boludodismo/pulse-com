import {beforeEach,describe,expect,it,vi} from 'vitest';
import {getTableName} from 'drizzle-orm';
import {MySqlDialect} from 'drizzle-orm/mysql-core';
const mocks=vi.hoisted(()=>({getDb:vi.fn()}));
vi.mock('./db',()=>({getDb:mocks.getDb}));
vi.mock('./saas',()=>({isUserAccessActive:async()=>true,hasModulePermission:async()=>true}));
vi.mock('./invitedArtistAccess',()=>({assertInvitedArtistAccess:async()=>{}}));
import {podSaasRouter} from './routers/podSaas';
let data:Record<string,any[]>;let nextId:number;
const dialect=new MySqlDialect();
const filter=(condition:any)=>(row:any)=>{
 if(!condition)return true;
 const query=dialect.sqlToQuery(condition);let i=0;
 const tests=[...query.sql.matchAll(/`[^`]+`\.`([^`]+)` = \?/g)].map(m=>[m[1],query.params[i++]]);
 return tests.every(([key,value])=>row[key as string]===value);
};
beforeEach(()=>{
 nextId=100;
 data={artists:[{id:4,studioId:2,active:1}],technical_procedures:[{id:1,studioId:2,clientId:3,artistId:4,status:'em_andamento',appointmentId:null}],procedure_ink_recipes:[{id:61,studioId:2,procedureId:1,code:'M01',status:'active',refillRecipeId:null,cupSize:'M',dropsPerMl:'20.000'}],tenant_materials:[{id:11,studioId:2,isActive:1,ownerArtistId:4,name:'Tinta preta',category:'Tinta',unit:'ml',currentQuantity:'10.000',unitCost:'2.0000'},{id:14,studioId:2,isActive:1,ownerArtistId:4,name:'Tinta branca',category:'Tinta',unit:'ml',currentQuantity:'5.000',unitCost:'3.0000'}],procedure_events:[],procedure_ink_recipe_items:[],procedure_inventory_consumptions:[],tenant_inventory_movements:[]};
 const db:any={transaction:async(fn:any)=>{const before=structuredClone(data);try{return await fn(db);}catch(e){data=before;throw e;}},select:()=>{let table='',condition:any,limit=Infinity;const q:any={from:(t:any)=>{table=getTableName(t);return q;},where:(c:any)=>{condition=c;return q;},limit:(n:number)=>{limit=n;return q;},for:()=>q,orderBy:()=>q,then:(resolve:any,reject:any)=>Promise.resolve((data[table]||[]).filter(filter(condition)).slice(0,limit)).then(resolve,reject)};return q;},insert:(t:any)=>({values:async(v:any)=>{const table=getTableName(t),id=++nextId;(data[table]??=[]).push({id,...v});return[{insertId:id}];}}),update:(t:any)=>({set:(values:any)=>({where:async(c:any)=>{const rows=(data[getTableName(t)]||[]).filter(filter(c));for(const row of rows)Object.assign(row,values);return[{affectedRows:rows.length}];}})})};
 mocks.getDb.mockResolvedValue(db);
});
const caller=()=>podSaasRouter.createCaller({user:{id:8,studioId:2,role:'admin'},req:{headers:{},socket:{}},res:{}} as any);
const input={procedureId:1,requestId:'134c63ed-2fba-4a3f-b0f3-515f47e806fe',refillRecipeId:61,cupSize:'M' as const,dropsPerMl:20,ingredients:[{tenantMaterialId:11,drops:4},{tenantMaterialId:14,drops:2}]};
describe('Transactional additions to an existing ink cup',()=>{
 it('links the addition to the original mixture and consumes only the new drops',async()=>{
  const result=await caller().session.saveInkRecipe(input);
  expect(data.tenant_materials.map(r=>r.currentQuantity)).toEqual(['9.800','4.900']);
  expect(data.procedure_ink_recipes.find(r=>r.id===result.id)).toMatchObject({refillRecipeId:61,totalDrops:6,cupTenantMaterialId:null});
  expect(result.cupConsumptionId).toBeNull();expect(result.consumptionIds).toHaveLength(2);
  expect(data.procedure_ink_recipes.find(r=>r.id===61)?.code).toBe('M01');
 });
 it('does not consume twice after a request retry',async()=>{
  const first=await caller().session.saveInkRecipe(input);const second=await caller().session.saveInkRecipe(input);
  expect(second).toEqual(first);expect(data.tenant_materials[0].currentQuantity).toBe('9.800');expect(data.procedure_ink_recipes).toHaveLength(2);
 });
 it('rolls back all ingredients and history when one color has insufficient stock',async()=>{
  data.tenant_materials[1].currentQuantity='0.050';
  await expect(caller().session.saveInkRecipe(input)).rejects.toThrow('Saldo insuficiente');
  expect(data.tenant_materials[0].currentQuantity).toBe('10.000');expect(data.procedure_ink_recipes).toHaveLength(1);expect(data.procedure_inventory_consumptions).toEqual([]);
 });
 it.each([{studioId:99},{procedureId:99},{status:'reverted'},{refillRecipeId:5}])('rejects an unavailable or unrelated base mixture %j',async(changes)=>{
  Object.assign(data.procedure_ink_recipes[0],changes);
  await expect(caller().session.saveInkRecipe(input)).rejects.toThrow('mistura original ativa');expect(data.tenant_materials[0].currentQuantity).toBe('10.000');
 });
 it('never debits another cup when replenishing',async()=>{
  await expect(caller().session.saveInkRecipe({...input,cupTenantMaterialId:21})).rejects.toThrow('batoque existente');
 });
 it('rejects additions in a finished session',async()=>{
  data.technical_procedures[0].status='finalizado';await expect(caller().session.saveInkRecipe(input)).rejects.toThrow('finalizada');
 });
 it('prevents undoing the base while an active addition exists',async()=>{
  data.procedure_ink_recipes.push({id:62,studioId:2,procedureId:1,refillRecipeId:61,status:'active'});
  await expect(caller().session.revertInkRecipe({recipeId:61})).rejects.toThrow('primeiro as reposições');
 });
});
