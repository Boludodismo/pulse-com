import { describe, it, expect } from 'vitest';
import { assertManagedUser, safeUser } from './userAccess';
const admin = { id: 1, role: 'admin', studioId: 10 };
describe('user management tenant boundaries', () => {
  it('rejects another studio and global owner', () => {
    expect(() => assertManagedUser(admin, {id: 2, role: 'admin', studioId: 20})).toThrow();
    expect(() => assertManagedUser(admin, {id: 2, role: 'superadmin', studioId: 10})).toThrow();
  });
  it('allows managing an ordinary member within the same studio', () => {
    expect(() => assertManagedUser(admin, {id: 2, role: 'collaborator', studioId: 10})).not.toThrow();
  });
  it('rejects privilege escalation, tenant reassignment, and unscoped creation', () => {
    const member = {id: 2, role: 'collaborator', studioId: 10};
    expect(() => assertManagedUser(admin, member, {role: 'superadmin'})).toThrow();
    expect(() => assertManagedUser(admin, member, {studioId: 20})).toThrow();
    expect(() => assertManagedUser(admin, undefined, {}, true)).toThrow();
  });
  it('allows owner management and excludes password hashes from responses', () => {
    expect(() => assertManagedUser({...admin,role:'superadmin'}, {id:2,role:'admin',studioId:20})).not.toThrow();
    expect(safeUser({...admin,passwordHash:'sensitive'})).toEqual(admin);
  });
});
