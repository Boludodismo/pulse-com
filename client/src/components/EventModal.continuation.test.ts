import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const m=vi.hoisted(()=>({queries:[] as any[],mutations:{} as Record<string,any>,assign:vi.fn(),original:{id:55,studioId:1,clientId:3,artistId:7,artist:'Ana',date:'2026-10-19 14:00:00',duration:60,service:'Tatuagem',calendarId:9,status:'concluido',attendanceStatus:'present',sessionStatus:'completed'},view:{appointmentId:55,clientName:'Maria',revision:2,state:{attendance:'present',session:'completed',needsMore:false}}}));
vi.mock('@/lib/trpc',()=>{
  const proxy=(path:string[]=[]):any=>new Proxy(()=>Promise.resolve(),{get:(_t,key)=>{
    if(key==='useUtils')return ()=>proxy();
    if(key==='useQuery')return(input:any,options:any)=>{const name=path.join('.');m.queries.push({name,input,options});return{data:name==='auth.me'?{role:'admin',studioId:1}:name==='appointments.list'?[m.original]:name==='attendance.view'?m.view:[],isLoading:false,refetch:vi.fn()};};
    if(key==='useMutation')return(options:any)=>{m.mutations[path.join('.')]=options;return{isPending:false,mutate:vi.fn(),mutateAsync:vi.fn()};};
    return proxy([...path,String(key)]);
  }});return{trpc:proxy()};
});
vi.mock('@/hooks/useArtistAccess',()=>({useArtistAccess:()=>({can:()=>true})}));
vi.mock('@/hooks/useSyncToast',()=>({useSyncToast:()=>({notifySync:vi.fn()})}));
vi.mock('./AppointmentMaterials',()=>({default:()=>null}));
vi.mock('sonner',()=>({toast:{success:vi.fn(),warning:vi.fn(),error:vi.fn(),info:vi.fn()}}));
vi.mock('./ui/dialog',async original=>({...await original<typeof import('./ui/dialog')>(),...Object.fromEntries(['Dialog','DialogContent','DialogHeader','DialogTitle'].map(name=>[name,({children}:any)=>children]))}));
import {EventModal} from './EventModal';
import {AttendancePanel} from './AttendancePanel';
beforeEach(()=>{m.queries=[];m.mutations={};m.assign.mockClear();vi.stubGlobal('window',{innerWidth:1024,location:{assign:m.assign}});});
afterEach(()=>vi.unstubAllGlobals());

describe('Continuing an appointment creates another session',()=>{
  it('opens a creation form even if a caller retained the old event ID',()=>{
    const html=renderToStaticMarkup(createElement(EventModal,{isOpen:true,onClose:vi.fn(),eventId:55,initialContinuation:{...m.original,artistId:7}}));
    expect(html).toContain('Agendar nova sessão');expect(html).toContain('Criar nova sessão');expect(html).toContain('O atendimento anterior permanece na agenda');expect(html).not.toContain('Editar Agendamento');
    expect(m.queries.find(q=>q.name==='appointments.reminders.list')?.options.enabled).toBe(false);
    expect(html).toMatch(/<input(?=[^>]*id="date")(?![^>]*\sdisabled=)[^>]*>/);
  });
  it('keeps the recorded appointment calendar date, time and duration read-only',()=>{
    const html=renderToStaticMarkup(createElement(EventModal,{isOpen:true,onClose:vi.fn(),eventId:55}));
    expect(html).toContain('ficam preservados no histórico');
    for(const id of ['date','startTime'])expect(html).toMatch(new RegExp(`<input(?=[^>]*id="${id}")(?=[^>]*\\sdisabled=)[^>]*>`));
    expect(html).toContain('/schedule?continuar=55');
  });
  it('confirmation stays on the current appointment and more sessions opens a new creation flow after saving',()=>{
    renderToStaticMarkup(createElement(AttendancePanel,{appointmentId:55}));
    const success=m.mutations['attendance.act'].onSuccess;
    success({}, {action:'present'});expect(m.assign).not.toHaveBeenCalled();
    success({}, {action:'needs_more'});expect(m.assign).toHaveBeenCalledWith('/schedule?continuar=55');
  });
  it('does not open a new booking when recording the operation failed',()=>{
    renderToStaticMarkup(createElement(AttendancePanel,{appointmentId:55}));
    m.mutations['attendance.act'].onError({message:'Falha ao salvar'});expect(m.assign).not.toHaveBeenCalled();
  });
});
