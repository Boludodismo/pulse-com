import { describe, expect, it, vi } from 'vitest';
import { archiveEmptyLegacyClients } from './archiveEmptyLegacyClients';
function database(done=false) {
  const query=vi.fn(async (sql:string) => {
    if(sql.startsWith('SELECT version')) return [done?[{version:'done'}]:[]];
    if(sql.includes('information_schema')) return [[{tableName:'anamnese_submissions',columnName:'clientId'},{tableName:'appointments',columnName:'clientId'}]];
    return [[]];
  });
  const execute=vi.fn(async (sql:string) => {
    if(sql.startsWith('SELECT id')) return [[{id:1},{id:2},{id:3}]];
    if(sql.includes('FROM `anamnese_submissions`')) return [[{id:2}]];
    if(sql.includes('FROM `appointments`')) return [[{id:3}]];
    return [[]];
  });
  return {query,execute,beginTransaction:vi.fn(),commit:vi.fn(),rollback:vi.fn()};
}
describe('reversible incomplete-client cleanup',()=>{
  it('archives only clients without references, preserving anamneses and appointments',async()=>{
    const db=database();
    await archiveEmptyLegacyClients(db as any,10);
    const updates=db.execute.mock.calls.filter(([sql])=>sql.startsWith('UPDATE'));
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual(['UPDATE clients SET isArchived=1 WHERE id=? AND studioId=?',[1,10]]);
    expect(db.execute.mock.calls.some(([sql])=>sql.startsWith('DELETE'))).toBe(false);
  });
  it('does not repeat cleanup for subsequently registered clients',async()=>{
    const db=database(true);
    await archiveEmptyLegacyClients(db as any,10);
    expect(db.execute).not.toHaveBeenCalled();
  });
});
