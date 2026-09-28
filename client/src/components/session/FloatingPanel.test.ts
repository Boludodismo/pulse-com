import {describe,it,expect} from 'vitest';
import {clampPanel} from './FloatingPanel';
describe('painéis do Modo Sessão',()=>{
 it('mantém a alça acessível ao mudar de computador para celular',()=>{
  expect(clampPanel({x:1100,y:650},280,500,374,700)).toEqual({x:94,y:200});
 });
 it('limita painéis maiores que a área no modo paisagem',()=>{
  expect(clampPanel({x:100,y:300},280,500,240,260)).toEqual({x:0,y:0});
 });
 it('impede que o arraste esconda painéis fora da borda superior',()=>{
  expect(clampPanel({x:-200,y:-30},64,300,800,900)).toEqual({x:0,y:0});
 });
});
