import { describe, it, expect } from 'vitest';
import { openSessionWindow } from './useSessionWindows';
import { boundWindow } from './SessionGlassWindow';

describe('session window workflows', () => {
  it('keeps independent tools open and raises an existing tool without duplicating it', () => {
    expect(openSessionWindow(['notes', 'appearance', 'materials'], 'notes')).toEqual(['appearance', 'materials', 'notes']);
  });
  it('preserves the exclusive workflow of editors sharing a draft', () => {
    expect(openSessionWindow(['notes', 'ink', 'appearance'], 'recipe')).toEqual(['notes', 'appearance', 'recipe']);
    expect(openSessionWindow(['materials', 'recipe'], 'sample')).toEqual(['materials', 'sample']);
  });
  it('clamps the complete window including its initial centered origin', () => {
    expect(boundWindow({x: 350 + 999, y: 66 + 999}, 740, 500, 1424, 884)).toEqual({x:684,y:384});
    expect(boundWindow({x:-99,y:-99},304,430,304,552)).toEqual({x:0,y:0});
    expect(boundWindow({x:10,y:10},740,720,304,304)).toEqual({x:0,y:0});
  });
});
