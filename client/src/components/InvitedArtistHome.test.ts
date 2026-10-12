import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { createElement } from 'react';
vi.stubGlobal('React', React);
import { renderToStaticMarkup } from 'react-dom/server';
const mock = vi.hoisted(() => ({ permissions: [] as any[], data: {} as any, stockOptions: {} as any, error: false }));
vi.mock('@/_core/hooks/useAuth', () => ({ useAuth: () => ({ user: {name:'Willian',artistId:202} }) }));
vi.mock('wouter', () => ({useLocation: () => ['/',vi.fn()]}));
vi.mock('./ArtistCardEditor', () => ({default: () => null}));
vi.mock('@/lib/trpc', () => ({trpc: {
 artistInvitations: {access:{useQuery: () => ({data:mock.permissions})}},
 artistDashboard: {overview:{useQuery: () => ({data: mock.error ? undefined : mock.data,isLoading:false,isError:mock.error,refetch:vi.fn()})}},
 pod:{inventory:{list:{useQuery: (_:any,options:any) => { mock.stockOptions=options;return {data:[],isLoading:false,isError:false}; }}}},
}}));
import InvitedArtistHome from './InvitedArtistHome';
beforeEach(() => {mock.permissions=[];mock.error=false;mock.data={artist:{name:'Willian Cunha',photoUrl:null},today:'2026-10-12',totalClients:null,appointments:null,finance:null,birthdays:null,upcoming:null,consumables:null};});
describe('painel do artista',()=>{
 it('não monta atalhos nem consulta estoque sem permissão',()=>{
  const html=renderToStaticMarkup(createElement(InvitedArtistHome));
  expect(html).toContain('Meu cartão');expect(html).toContain('Meus acessos');expect(html).not.toContain('Minha agenda');expect(html).not.toContain('Novo cliente');expect(html).not.toContain('Meu estoque');expect(mock.stockOptions.enabled).toBe(false);
 });
 it('apresenta dados pessoais e cartões responsivos sem cortar nomes',()=>{
  mock.permissions=['clients','appointments','stock'].map(module=>({module,canRead:1,canWrite:0}));
  mock.data.totalClients=8;mock.data.appointments={count:4,completed:1};mock.data.upcoming=[{id:1,clientName:'Nome completo do cliente',date:'2026-10-12 15:30:00',service:'Realismo',status:'confirmado'}];mock.data.birthdays=[];
  const html=renderToStaticMarkup(createElement(InvitedArtistHome));
  expect(html).toContain('Próximos atendimentos');expect(html).toContain('Nome completo do cliente');expect(html).toContain('15:30');expect(html).toContain('min-[360px]:grid-cols-2');expect(html).toContain('break-words');expect(html).not.toContain('Novo cliente');expect(mock.stockOptions.enabled).toBe(true);
 });
 it('falha ao carregar não mostra indicadores falsos zerados',()=>{
  mock.error=true;const html=renderToStaticMarkup(createElement(InvitedArtistHome));
  expect(html).toContain('Tentar novamente');expect(html).not.toContain('Minha participação');
 });
});
