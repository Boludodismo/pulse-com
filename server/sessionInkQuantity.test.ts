import { describe, it, expect } from 'vitest';
import { inkStockQuantity, sessionCupSize, isSessionCup, isSessionInk } from '../shared/sessionInkQuantity';
describe('session ink consumption in inventory units', () => {
  it('converts drops to ml without consuming an entire bottle', () => {
    expect(inkStockQuantity('ml', 1, 'drops', 'M')).toBe('0.050');
    expect(inkStockQuantity('ml', 10, 'drops', 'M')).toBe('0.500');
    expect(inkStockQuantity('gotas', 10, 'drops', 'M')).toBe('10.000');
  });
  it('uses the selected cap capacity and count', () => {
    expect(inkStockQuantity('ml', 1, 'cup', 'P')).toBe('0.500');
    expect(inkStockQuantity('ml', 1, 'cup', 'M')).toBe('1.000');
    expect(inkStockQuantity('ml', 2, 'cup', 'G')).toBe('4.000');
    expect(inkStockQuantity('drop', 1, 'cup', 'GG')).toBe('80.000');
    expect(inkStockQuantity('ml', 2, 'cup', 0.25)).toBe('0.500');
    expect(inkStockQuantity('ml', 2, 'cup', 0)).toBe('');
  });
  it('rejects invalid counts and unsupported inventory units', () => {
    for (const n of [0,-1,1.5,NaN,Infinity]) expect(inkStockQuantity('ml',n,'cup','M')).toBe('');
    expect(inkStockQuantity('frasco',1,'drops','M')).toBe('');
  });
  it('keeps cap items separate from ink and reads their exact size', () => {
    const m={name:'Ink Cap Electric Ink GG',unit:'un'};
    expect(isSessionCup(m)).toBe(true);
    expect(isSessionInk(m)).toBe(false);
    expect(sessionCupSize(m)).toBe('GG');
    expect(sessionCupSize({name:'Batoque',configuration:'P',unit:'un'})).toBe('P');
  });
});
