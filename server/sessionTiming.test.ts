import {describe,it,expect} from 'vitest';
import {effectiveSessionSeconds} from '../shared/sessionTiming';
describe('Timer pause/resume precision',()=>{
 const start='2026-10-21T12:00:00Z';
 it('preserves seconds while paused, including sessions shorter than a minute',()=>{
  const pauses=[{startedAt:'2026-10-21T12:00:37Z',endedAt:null}];
  expect(effectiveSessionSeconds(start,null,pauses,Date.parse('2026-10-21T12:05:00Z'))).toBe(37);
 });
 it('continues from the accumulated seconds after a completed pause',()=>{
  const pauses=[{startedAt:'2026-10-21T12:00:37Z',endedAt:'2026-10-21T12:01:22Z'}];
  expect(effectiveSessionSeconds(start,null,pauses,Date.parse('2026-10-21T12:01:48Z'))).toBe(63);
 });
 it('excludes multiple pauses and freezes the completed session',()=>{
  const pauses=[{startedAt:'2026-10-21T12:00:37Z',endedAt:'2026-10-21T12:01:22Z'},{startedAt:'2026-10-21T12:02:00Z',endedAt:'2026-10-21T12:02:20Z'}];
  expect(effectiveSessionSeconds(start,'2026-10-21T12:03:10Z',pauses,Date.parse('2026-10-21T13:00:00Z'))).toBe(125);
 });
 it('keeps a new or invalid session at zero',()=>{
  expect(effectiveSessionSeconds(null,null,[])).toBe(0);expect(effectiveSessionSeconds('invalid',null,[])).toBe(0);
 });
});
