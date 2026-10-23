import {describe,it,expect} from 'vitest';
import {technicalTiming} from './sessionTimer';
describe('technical timer UTC intervals',()=>{
 it('subtracts the union of bounded pauses without losing seconds',()=>{
  expect(technicalTiming('2030-01-01 10:00:00','2030-01-01 11:00:30',[
   {startedAt:'2030-01-01 09:55:00',endedAt:'2030-01-01 10:10:00'},
   {startedAt:'2030-01-01 10:05:00',endedAt:'2030-01-01 10:20:00'},
   {startedAt:'2030-01-01 10:50:00',endedAt:null},
  ])).toEqual({totalMinutes:60,pausedMinutes:30,effectiveMinutes:30,effectiveSeconds:1800});
 });
 it('does not count time before the first start',()=>expect(technicalTiming(null,null,[])).toEqual({totalMinutes:0,pausedMinutes:0,effectiveMinutes:0,effectiveSeconds:0}));
});
