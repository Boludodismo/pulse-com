import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ studios: [{id:1,name:'Meu Estúdio'}] as any[], settings:[{id:1,studioId:null,studioName:'Willian Cunha Tattoo',phone:'31999851316'}] as any[], query:vi.fn(), execute:vi.fn(), commit:vi.fn(), rollback:vi.fn(), end:vi.fn() }));
vi.mock('mysql2/promise', () => ({ default: { createConnection: async () => ({query:state.query,execute:state.execute,beginTransaction:vi.fn(),commit:state.commit,rollback:state.rollback,end:state.end}) }}));
import { ensureStudioSettingsScope } from './studioSettingsScope';
beforeEach(() => {
  vi.clearAllMocks(); process.env.DATABASE_URL='mysql://local/test';
  state.studios=[{id:1,name:'Meu Estúdio'}];
  state.settings=[{id:1,studioId:null,studioName:'Willian Cunha Tattoo',phone:'31999851316'}];
  state.query.mockImplementation(async (sql:string) => {
    if(sql.includes('GET_LOCK')) return [[{acquired:1}]];
    if(sql.startsWith('SELECT id,name')) return [state.studios];
    if(sql.startsWith('SELECT * FROM studioSettings')) return [state.settings];
    return [[]];
  });
});
describe('studio identity migration', () => {
  it('backs up and updates existing identity without creating a new studio', async () => {
    await ensureStudioSettingsScope();
    const queries=state.execute.mock.calls;
    expect(queries[0][0]).toContain('crm_studio_identity_backup');
    expect(queries[1][1]).toEqual([1,1]);
    expect(queries[2][1].slice(0,2)).toEqual(['Willian Cunha Tattoo','31999851316']);
    expect(state.commit).toHaveBeenCalledOnce();
    expect(state.end).toHaveBeenCalledOnce();
  });
  it('does not guess ownership with multiple studios', async () => {
    state.studios.push({id:2,name:'Outra empresa'});
    await ensureStudioSettingsScope();
    expect(state.execute).not.toHaveBeenCalled();
  });
  it('preserves identity on subsequent starts', async () => {
    state.settings[0].studioId=1;
    await ensureStudioSettingsScope();
    expect(state.execute).not.toHaveBeenCalled();
  });
});
