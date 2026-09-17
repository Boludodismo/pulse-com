import {describe,it,expect,vi} from 'vitest';
import {importTestInventory} from './inventoryTestImport';
import {tenantMaterials,tenantInventoryMovements,artists} from '../drizzle/schema';
import {TECHNICAL_CATALOG_2026} from '../shared/technicalCatalog2026';
import {catalogIdentity} from '../shared/inventoryTestCatalog';
function fixture(records:any[]=[]){
 const movements:any[]=[];const updates:any[]=[];
 const db:any={select:()=>({from:(table:unknown)=>{
   const rows=table===tenantMaterials?records:table===artists?[{id:7}]:[{id:3}];
   const chain:any={where:()=>chain,limit:()=>chain,for:async()=>rows,then:(r:any,j:any)=>Promise.resolve(rows).then(r,j)};return chain;
 }}),insert:(table:unknown)=>({values:async(v:any)=>{if(table===tenantMaterials)records.push({...v,id:100+records.length,isActive:1});if(table===tenantInventoryMovements)movements.push(v);return [{insertId:100+records.length-1}];}}),update:()=>({set:(v:any)=>({where:async()=>{updates.push(v);Object.assign(records[0],v);}})}),transaction:async(fn:any)=>fn(db)};
 return {db,records,movements,updates};
}
const ctx={studioId:3,artistId:null,user:{id:9,role:'admin'}};
describe('audited test import',()=>{
 it('rejects non-managers before reading inventory',async()=>{
   const db={select:vi.fn()} as any;
   await expect(importTestInventory(db,{...ctx,user:{id:9,role:'artist'}},{artistId:7,offset:908})).rejects.toThrow('administrador');
   expect(db.select).not.toHaveBeenCalled();
 });
 it('records one initial movement and does not replenish stock on retry',async()=>{
   const f=fixture();
   expect((await importTestInventory(f.db,ctx,{artistId:7,offset:908})).created).toBe(1);
   f.records[0].currentQuantity='1.000';
   expect((await importTestInventory(f.db,ctx,{artistId:7,offset:908})).created).toBe(0);
   expect(f.records[0].currentQuantity).toBe('1.000');expect(f.movements).toHaveLength(1);
   expect(f.movements[0].reason).toContain('FICTÍCIO');expect(f.records[0].studioId).toBe(3);expect(f.records[0].ownerArtistId).toBe(7);
 });
 it('preserves existing cost and stock; fills zero costs exactly once',async()=>{
   const item=TECHNICAL_CATALOG_2026[0];
   const f=fixture([{id:30,isActive:1,brand:item.brandName,line:item.lineName,model:item.sku,name:item.name,currentQuantity:'19.000',minimumQuantity:'5.000',unitCost:'0.0000',notes:'nota existente'}]);
   expect((await importTestInventory(f.db,ctx,{artistId:7,offset:0})).priced).toBe(1);
   expect(f.records[0].currentQuantity).toBe('19.000');expect(f.records[0].minimumQuantity).toBe('5.000');
   expect(JSON.parse(f.records[0].notes).previousNotes).toBe('nota existente');
   expect(f.movements[0].quantity).toBe('0.000');
   f.records[0].unitCost='0.0000';
   expect((await importTestInventory(f.db,ctx,{artistId:7,offset:0})).priced).toBe(0);
   expect(f.updates).toHaveLength(1);
 });
 it('never recreates an archived test item',async()=>{
   const item=TECHNICAL_CATALOG_2026[908];const f=fixture([{id:10,isActive:0,notes:JSON.stringify({testCatalogIdentity:catalogIdentity(item)})}]);
   expect((await importTestInventory(f.db,ctx,{artistId:7,offset:908})).created).toBe(0);
 });
});
