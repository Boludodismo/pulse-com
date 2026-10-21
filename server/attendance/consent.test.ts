import {beforeEach,describe,expect,it,vi} from 'vitest';
import {getTableName} from 'drizzle-orm';
import {MySqlDialect} from 'drizzle-orm/mysql-core';
const mock=vi.hoisted(()=>({getDb:vi.fn()}));
vi.mock('../db',()=>({getDb:mock.getDb}));
import {ensureCareWhatsappConsent,recordFormWhatsappPermission,recordClientRegistrationPermission} from './consent';
let data:Record<string,any[]>,writes:any[],conditions:any[],tx:any;
beforeEach(()=>{
  vi.clearAllMocks();writes=[];conditions=[];
  data={clients:[{phone:'(31) 99999-8888'}],integration_contacts:[],whatsapp_integrations:[{id:19}],client_whatsapp_permissions:[]};
  tx={transaction:(fn:any)=>fn(tx),select:()=>{
    let table='';const q:any={from:(t:any)=>{table=getTableName(t);return q;},where:(condition:any)=>{conditions.push({table,...new MySqlDialect().sqlToQuery(condition)});return q;},limit:()=>q,for:async()=>data[table]??[],then:(resolve:any,reject:any)=>Promise.resolve(data[table]??[]).then(resolve,reject)};return q;
  },insert:(t:any)=>({values:(value:any)=>({onDuplicateKeyUpdate:async(set:any)=>{writes.push({table:getTableName(t),value,set:set.set});}})}),update:(t:any)=>({set:(value:any)=>({where:async()=>{writes.push({table:getTableName(t),value});}})})};
  mock.getDb.mockResolvedValue(tx);
});
const record=(choice:boolean|null,phone:string|null='(31) 99999-8888')=>recordFormWhatsappPermission(tx,{studioId:2,clientId:3,phone,choice,requestId:40});
describe('Automatic registration of the customer’s explicit choice',()=>{
  it('records the form and integration authorization atomically',async()=>{await record(true);expect(writes.map(w=>w.table)).toEqual(['client_whatsapp_permissions','integration_contacts']);expect(writes[1].value).toMatchObject({studioId:2,clientId:3,integrationId:19,hasWhatsappOptIn:1,normalizedPhone:'+5531999998888'});expect(writes[1].value.optInSource).toContain('anamnese_cliente:40');});
  it('keeps permission when the integration has not been configured yet',async()=>{data.whatsapp_integrations=[];await record(true);expect(writes).toHaveLength(1);expect(writes[0].table).toBe('client_whatsapp_permissions');});
  it('does not re-enable an existing opt-out',async()=>{data.integration_contacts=[{id:5,optedOutAt:'2026-10-19 18:00:00'}];await record(true);expect(writes).toHaveLength(1);expect(writes[0].table).toBe('client_whatsapp_permissions');});
  it('refusal immediately blocks queued client deliveries through the existing contact gate',async()=>{data.integration_contacts=[{id:5,hasWhatsappOptIn:1}];await record(false);expect(writes[0].value.enabled).toBe(0);expect(writes[1].value).toMatchObject({hasWhatsappOptIn:0,optedOutAt:expect.any(String)});});
  it('old payloads, missing phones or invalid phones never create permission',async()=>{await record(null);await record(true,null);await record(true,'invalid');expect(writes).toEqual([]);});
  it('refusal revokes old permission even if the phone was removed on the same form',async()=>{data.integration_contacts=[{id:5,hasWhatsappOptIn:1,normalizedPhone:'+5531999998888'}];await record(false,null);expect(writes[0].value.enabled).toBe(0);expect(writes[1].value.hasWhatsappOptIn).toBe(0);});
});
describe('Eligibility for birthday and post-sale delivery',()=>{
  it('applies durable form permission when a channel becomes active',async()=>{data.client_whatsapp_permissions=[{enabled:1,normalizedPhone:'+5531999998888',recordedAt:'2026-10-19 12:00:00',source:'anamnese_cliente:40:whatsapp_v1'}];expect(await ensureCareWhatsappConsent(2,19,3)).toBe(true);expect(writes[0].value).toMatchObject({studioId:2,clientId:3,integrationId:19,hasWhatsappOptIn:1});});
  it('moves authorized same-studio contacts to the current channel without keeping an old provider subscriber ID',async()=>{data.integration_contacts=[{id:5,integrationId:11,hasWhatsappOptIn:1,normalizedPhone:'+5531999998888',providerSubscriberId:'old-provider',optInAt:'2026-10-19 12:00:00',optedOutAt:null}];expect(await ensureCareWhatsappConsent(2,19,3)).toBe(true);expect(writes[0].set).toMatchObject({integrationId:19,providerSubscriberId:null});});
  it('never infers permission from birthdate or another customer sharing the phone',async()=>{expect(await ensureCareWhatsappConsent(2,19,3)).toBe(false);expect(writes).toEqual([]);const contact=conditions.find(c=>c.table==='integration_contacts');expect(contact.params).toEqual([2,3]);expect(contact.sql).toContain('client_id');});
  it('a changed phone, refusal or opt-out blocks automatic reauthorization',async()=>{
    data.client_whatsapp_permissions=[{enabled:1,normalizedPhone:'+5531988887777'}];expect(await ensureCareWhatsappConsent(2,19,3)).toBe(false);
    data.client_whatsapp_permissions=[{enabled:0,normalizedPhone:'+5531999998888'}];expect(await ensureCareWhatsappConsent(2,19,3)).toBe(false);
    data.client_whatsapp_permissions=[{enabled:1,normalizedPhone:'+5531999998888'}];data.integration_contacts=[{hasWhatsappOptIn:1,normalizedPhone:'+5531999998888',optedOutAt:'2026-10-19 12:00:00'}];expect(await ensureCareWhatsappConsent(2,19,3)).toBe(false);expect(writes).toEqual([]);
  });
});

describe('New-client operational preference',()=>{
  const input={studioId:2,clientId:3,enabled:true,actorId:8};
  it('records the administrative source and scoped client without a channel',async()=>{
    data.whatsapp_integrations=[];
    expect(await recordClientRegistrationPermission(input)).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0].value).toMatchObject({studioId:2,clientId:3,enabled:1,source:'cadastro_cliente:operacional:usuario_8'});
    expect(conditions.find(c=>c.table==='clients').params).toEqual([3,2,0]);
  });
  it('materializes permission in an active integration',async()=>{
    await recordClientRegistrationPermission(input);
    expect(writes[1].value).toMatchObject({integrationId:19,clientId:3,hasWhatsappOptIn:1});
  });
  it('keeps explicit opt-outs blocked',async()=>{
    data.integration_contacts=[{id:5,optedOutAt:'2026-10-19 12:00:00'}];
    await recordClientRegistrationPermission(input);
    expect(writes).toHaveLength(0);
    expect(await ensureCareWhatsappConsent(2,19,3)).toBe(false);
  });
  it('preserves an earlier durable refusal',async()=>{
    data.client_whatsapp_permissions=[{enabled:0,normalizedPhone:'+5531999998888'}];
    expect(await recordClientRegistrationPermission(input)).toBe(false);
    expect(writes).toEqual([]);
  });
  it('saves unchecked choice even without a phone',async()=>{
    data.clients=[{phone:null}];
    expect(await recordClientRegistrationPermission({...input,enabled:false})).toBe(true);
    expect(writes[0].value.enabled).toBe(0);
  });
  it('never grants permission to an invalid phone or nonexistent scoped client',async()=>{
    data.clients=[{phone:'123'}];
    expect(await recordClientRegistrationPermission(input)).toBe(false);
    data.clients=[];
    await expect(recordClientRegistrationPermission(input)).rejects.toThrow('Client not found');
    expect(writes).toEqual([]);
  });
});
