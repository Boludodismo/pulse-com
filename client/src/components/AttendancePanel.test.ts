import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it} from 'vitest';
import {AttendanceActions} from './AttendancePanel';
import {emptyAttendance} from '@shared/attendance';

describe('Artist attendance actions',()=>{
  const render=(state=emptyAttendance)=>renderToStaticMarkup(createElement(AttendanceActions,{state,name:'Maria',pending:false,onAction:()=>{}}));
  it('asks for the actual scheduled customer and offers presence, delay, absence and session controls',()=>{const html=render();expect(html).toContain('Confirmar presença de Maria');expect(html).toContain('Cliente atrasado');expect(html).toContain('Não compareceu');expect(html).toContain('Iniciar sessão');expect(html).toContain('Finalizar sessão');});
  it('does not offer marking an already started session as a no-show',()=>{const html=render({attendance:'present',session:'in_progress',needsMore:false});expect(html).not.toContain('>Não compareceu</button>');expect(html).toContain('Finalizar sessão');});
  it('a no-show offers explicit correction instead of starting directly',()=>{const html=render({attendance:'no_show',session:'not_started',needsMore:false});expect(html).toContain('Corrigir falta');expect(html).not.toContain('Iniciar sessão');});
  it('a finished session displays its outcome without offering another completion',()=>{const html=render({attendance:'present',session:'completed',needsMore:true});expect(html).toContain('Precisa de outras sessões');expect(html).not.toContain('<button');});
});
