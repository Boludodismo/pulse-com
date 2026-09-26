import {describe,it,expect} from 'vitest';
import {defaultSessionQuantity} from '../shared/sessionMaterialDefaults';
import {SESSION_TEST_SUPPLIES} from '../shared/sessionTestSupplies';
import {testStock} from '../shared/inventoryTestCatalog';
describe('per-tap base units',()=>{
 it('does not consume the purchase package',()=>{
  expect(defaultSessionQuantity({name:'Fine Line 0603 caixa 20',unit:'un',category:'Cartuchos e agulhas'})).toBe('1');
  expect(defaultSessionQuantity({name:'Luva nitrílica preta P',unit:'par'})).toBe('1');
  for(const c of SESSION_TEST_SUPPLIES.filter(x=>x.sku?.startsWith('EI-INKCAP'))){expect(defaultSessionQuantity({name:c.name,unit:c.baseUnit})).toBe('1');expect(Number(testStock(c).quantity)).toBe(c.unitsPerPackage);}
 });
 it('uses grams for vaseline and ml for inks without converting unrelated units',()=>{
  expect(defaultSessionQuantity({name:'Vaselina Slip',unit:'g'})).toBe('20');
  expect(defaultSessionQuantity({name:'Vaselina',unit:'pote'})).toBe('1');
  expect(defaultSessionQuantity({name:'Preto Linha',unit:'ml',category:'Tintas e pigmentos'})).toBe('0.5');
 });
});
