import { describe,it,expect,vi,beforeEach } from 'vitest';
vi.mock('./saas',()=>({isUserAccessActive:vi.fn(async()=>true)}));
vi.mock('./invitedArtistAccess',()=>({assertInvitedArtistAccess:vi.fn(async()=>{})}));
const {execute}=vi.hoisted(()=>({execute:vi.fn()}));
vi.mock('./db',()=>({getDb:vi.fn(async()=>({execute}))}));
import {legacyArchiveRouter} from './routers/legacyArchive';
import {isLegacyArchiveTable} from '../shared/legacyArchive';
const caller=(role:string)=>legacyArchiveRouter.createCaller({user:{id:1,role,studioId:1},req:{},res:{}} as any);
describe('legacy archive authorization',()=>{
 beforeEach(()=>{execute.mockReset();});
 it('rejects SQL injection and unapproved tables',()=>{
  for(const x of ['users','__proto__','constructor','catalog_brands; DROP TABLE users']) expect(isLegacyArchiveTable(x)).toBe(false);
 });
 it('denies collaborators before touching the database',async()=>{
  await expect(caller('collaborator').list({table:'catalog_brands'})).rejects.toMatchObject({code:'FORBIDDEN'});
  expect(execute).not.toHaveBeenCalled();
 });
 it('denies studio admins access to global legacy records',async()=>{
  await expect(caller('admin').list({table:'catalog_brands'})).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('returns an empty archive when the legacy table does not exist',async()=>{
  execute.mockResolvedValue([[]]);
  await expect(caller('superadmin').list({table:'catalog_brands'})).resolves.toEqual({rows:[],total:0});
 });
});
