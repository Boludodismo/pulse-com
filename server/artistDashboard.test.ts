import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import { getTableName } from 'drizzle-orm';
const mock = vi.hoisted(() => ({ permissions: [] as any[], queries: [] as any[], database: null as any }));
vi.mock('./db', () => ({ getDb: async () => mock.database }));
vi.mock('./saas', () => ({ listUserPermissions: async () => mock.permissions, isUserAccessActive: async () => true, hasModulePermission: async () => false }));
import { artistDashboardScope, getArtistDashboard, upcomingArtistBirthdays } from './artistDashboard';
import { invitedRoutePermission } from './invitedArtistAccess';
const user = { id: 7, role: 'collaborator', studioId: 101, artistId: 202 };
beforeEach(() => {
  mock.permissions = []; mock.queries = [];
  mock.database = { select: () => {
    let table = ''; const query: any = {
      from: (t: any) => { table = getTableName(t); return query; },
      where: (condition: any) => { mock.queries.push({ table, ...new MySqlDialect().sqlToQuery(condition) }); return query; },
      leftJoin: () => query, innerJoin: () => query, orderBy: () => query, limit: () => query,
      then: (resolve: any) => Promise.resolve(table === 'artists' ? [{ name: 'Artista', photoUrl: null, specialty: null }] : table === 'collaborator_rates' ? [{ percentage: 30 }] : []).then(resolve),
    }; return query;
  }};
});
describe('dashboard pessoal do artista', () => {
  it.each([{...user, artistId: null}, {...user, studioId: null}, {...user, role: 'admin'}, {...user, artistId: -1}])('recusa vínculo inválido antes de consultar dados', async invalid => {
    expect(() => artistDashboardScope(invalid)).toThrow();
    await expect(getArtistDashboard(invalid)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(mock.queries).toEqual([]);
  });
  it('sem permissões retorna somente a identificação e não consulta métricas', async () => {
    const data = await getArtistDashboard(user);
    expect(data).toMatchObject({ totalClients: null, appointments: null, finance: null, upcoming: null, birthdays: null, consumables: null });
    expect(mock.queries.map(q => q.table)).toEqual(['artists']);
  });
  it('financeiro sozinho não libera nomes de clientes nem a agenda', async () => {
    mock.permissions = [{ module: 'finance', canRead: 1 }];
    const data = await getArtistDashboard(user);
    expect(data.upcoming).toBeNull(); expect(data.birthdays).toBeNull(); expect(data.appointments).toBeNull();
    expect(data.finance).toMatchObject({ paid: 0, earnings: 0 });
    expect(mock.queries.some(q => q.table === 'clients')).toBe(false);
    for (const query of mock.queries) {
      expect(query.params).toContain(101); expect(query.params).toContain(202);
    }
  });
  it.each([[101,202], [303,404]])('filtra todas as consultas por estúdio %i e artista %i', async (studioId,artistId) => {
    mock.permissions = ['clients','appointments','finance','pod'].map(module => ({module,canRead:1}));
    await getArtistDashboard({...user,studioId,artistId});
    expect(mock.queries.length).toBeGreaterThan(5);
    for (const query of mock.queries) {
      expect(query.sql).toContain('studioId'); expect(query.params).toContain(studioId); expect(query.params).toContain(artistId);
      if(query.table !== 'artists') expect(query.sql).toContain('artistId');
    }
  });
  it('mantém dashboards globais bloqueados ao convidado', () => {
    expect(invitedRoutePermission('artistDashboard.overview')).toBe('self');
    expect(invitedRoutePermission('dashboard.metrics')).toBeNull();
    expect(invitedRoutePermission('stock.getLowStock')).toBeNull();
  });
  it('inclui aniversário de hoje e trata mudança de ano', () => {
    expect(upcomingArtistBirthdays([{id:1,name:'Hoje',birthDate:'2000-12-20'}, {id:2,name:'Janeiro',birthDate:'1990-01-02'}, {id:3,name:'Fora',birthDate:'1990-02-02'}], '2026-12-20')).toEqual([{id:1,name:'Hoje',date:'2026-12-20',days:0},{id:2,name:'Janeiro',date:'2027-01-02',days:13}]);
  });
});
