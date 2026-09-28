import {describe,it,expect} from 'vitest';
import {TECHNICAL_CATALOG_2026,canAddCatalogItemToOperationalStock} from '../shared/technicalCatalog2026';
import {catalogIdentity,estimatePrice,testStock,TEST_IMPORTABLE_COUNT} from '../shared/inventoryTestCatalog';
describe('full test catalog',()=>{
 it('keeps blocked items excluded',()=>{expect(TEST_IMPORTABLE_COUNT).toBe(906);expect(TECHNICAL_CATALOG_2026.filter(x=>!canAddCatalogItemToOperationalStock(x)).map(x=>x.brandName)).toEqual(['Dynamic','Dynamic','Dynamic']);});
 it('converts packages to base units rather than charging package price per tap',()=>{
   const glove=TECHNICAL_CATALOG_2026.find(x=>x.name==='Luva nitrílica preta P')!;
   expect(estimatePrice(glove).unitCost).toBe('0.7980');
   expect(estimatePrice(TECHNICAL_CATALOG_2026.find(x=>x.name==='Fine Line 0603')!).unitCost).toBe('9.4500');
   expect(Number(estimatePrice(TECHNICAL_CATALOG_2026.find(x=>x.brandName==='Electric Ink'&&x.volumeMl===30)!).unitCost)).toBeCloseTo(89.9/30,4);
 });
 it('has explicit evidence and sensible positive stock/minimum for every eligible reference',()=>{
   for(const item of TECHNICAL_CATALOG_2026.filter(canAddCatalogItemToOperationalStock)){
     const p=estimatePrice(item),s=testStock(item);
     if(p.estimated){expect(Number(p.unitCost),item.name).toBeGreaterThan(0);expect(p.reference?.url).toMatch(/^https:\/\//);}
     else {expect(p.status).toBe('pending');expect(p.unitCost).toBe('0.0000');expect(p.reference).toBeUndefined();}
     expect(Number(s.minimum)).toBeGreaterThan(0);
     expect(Number(s.quantity)).toBeGreaterThan(Number(s.minimum));
   }
 });
 it('distinguishes manufacturer and line even when product codes coincide',()=>{
   const i=TECHNICAL_CATALOG_2026[0];expect(catalogIdentity(i)).not.toBe(catalogIdentity({...i,brandName:'Other'}));
   expect(catalogIdentity(i)).not.toBe(catalogIdentity({...i,lineName:'Other'}));
 });
});
