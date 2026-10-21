import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({createClient:vi.fn(),listClients:vi.fn(),permission:vi.fn()}));
vi.mock('./db',()=>mock);
vi.mock('./attendance/consent',()=>({recordClientRegistrationPermission:mock.permission}));
vi.mock('./saas',async original=>({...await original<typeof import('./saas')>(),isUserAccessActive:async()=>true}));
vi.mock('./invitedArtistAccess',()=>({assertInvitedArtistAccess:async()=>{}}));
import {contactsRouter} from './routers/contacts';
const caller=()=>contactsRouter.createCaller({user:{id:8,studioId:2,role:'admin'},req:{headers:{},socket:{}},res:{}} as any);
const csv='nome,telefone\nCliente Fixture,(31) 99999-8888';
beforeEach(()=>{vi.clearAllMocks();mock.createClient.mockResolvedValue({id:10});mock.listClients.mockResolvedValue([]);mock.permission.mockResolvedValue(true);});
describe('Imported client notification choice',()=>{
 it('enables new imported clients by default',async()=>{
  const result=await caller().importContacts({format:'csv',content:csv});
  expect(result).toMatchObject({imported:1,errors:0,notificationWarnings:0});
  expect(mock.permission).toHaveBeenCalledWith({studioId:2,clientId:10,enabled:true,actorId:8});
 });
 it('respects the unchecked option',async()=>{
  await caller().importContacts({format:'csv',content:csv,recordWhatsAppConsent:false});
  expect(mock.permission).toHaveBeenCalledWith(expect.objectContaining({enabled:false}));
 });
 it('does not alter consent on skipped existing clients',async()=>{
  mock.listClients.mockResolvedValue([{id:5,phone:'31999998888'}]);
  const result=await caller().importContacts({format:'csv',content:csv});
  expect(result).toMatchObject({imported:0,skipped:1});expect(mock.permission).not.toHaveBeenCalled();
 });
 it('reports preference failure without falsely reporting the insert as failed',async()=>{
  mock.permission.mockRejectedValue(new Error('storage unavailable'));
  const result=await caller().importContacts({format:'csv',content:csv});
  expect(result).toMatchObject({imported:1,errors:0,notificationWarnings:1});expect(mock.createClient).toHaveBeenCalledOnce();
 });
});
