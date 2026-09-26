import { SESSION_TEST_SUPPLIES } from '../shared/sessionTestSupplies';
import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { tenantMaterials, tenantInventoryMovements, studios } from '../drizzle/schema';
import { TECHNICAL_CATALOG_2026, canAddCatalogItemToOperationalStock } from '../shared/technicalCatalog2026';
import { catalogIdentity, estimatePrice, readTestMetadata, testStock, TEST_CATALOG_VERSION, TEST_STOCK_REASON } from '../shared/inventoryTestCatalog';
import { isInventoryManager, requireInventoryArtist, type InventoryContext, type InventoryDatabase } from './inventoryAccess';

export async function importTestInventory(database:InventoryDatabase, ctx:InventoryContext & {user:{role:string;id:number}}, input:{artistId:number;offset:number;profile?:'session'}) {
 if(!isInventoryManager(ctx))throw new TRPCError({code:'FORBIDDEN',message:'Somente o administrador pode importar o estoque de teste.'});
 await requireInventoryArtist(database,ctx.studioId,input.artistId);
 return database.transaction(async tx=>{
   await tx.select({id:studios.id}).from(studios).where(eq(studios.id,ctx.studioId)).limit(1).for('update');
   // Include inactive records: a repeat import must never recreate archived test items.
   const existing=await tx.select().from(tenantMaterials).where(eq(tenantMaterials.studioId,ctx.studioId)).for('update');
   let created=0,preserved=0,priced=0,blocked=0;
   const catalog=input.profile==='session'?SESSION_TEST_SUPPLIES:TECHNICAL_CATALOG_2026;
   const end=Math.min(input.offset+25,catalog.length);
   for(let index=input.offset;index<end;index++){
     const item=catalog[index];
     if(!canAddCatalogItemToOperationalStock(item)){blocked++;continue;}
     const identity=catalogIdentity(item),price=estimatePrice(item),stock=testStock(item);
     const found=existing.find(m=>readTestMetadata(m.notes).testCatalogIdentity===identity || catalogIdentity({brandName:m.brand??'',lineName:m.line??'',sku:m.model,name:m.name})===identity);
     if(found){
       preserved++;
       // Preserve all balances, thresholds and nonzero costs, including consumption made during tests.
       // A recorded estimate is never re-applied after the owner edits it to zero.
       const meta=readTestMetadata(found.notes);
       if(found.isActive===1 && Number(found.unitCost)===0 && !meta.marketEstimate && price.estimated){
         const notes=JSON.stringify({...meta,...(!Object.keys(meta).length&&found.notes?{previousNotes:found.notes}:{}),marketEstimate:price});
         await tx.update(tenantMaterials).set({unitCost:price.unitCost,notes}).where(and(eq(tenantMaterials.id,found.id),eq(tenantMaterials.studioId,ctx.studioId)));
         await tx.insert(tenantInventoryMovements).values({studioId:ctx.studioId,tenantMaterialId:found.id,type:'ajuste',quantity:'0.000',previousQuantity:found.currentQuantity,newQuantity:found.currentQuantity,sourceType:TEST_CATALOG_VERSION,sourceId:found.id,reason:'Custo estimado de mercado preenchido; saldo preservado',notes:JSON.stringify({previousUnitCost:found.unitCost,marketEstimate:price}),createdByUserId:ctx.user.id});
         priced++;
       }
       continue;
     }
     const notes=JSON.stringify({catalog:'2026-09-07',...item,testStock:true,testCatalogVersion:TEST_CATALOG_VERSION,testCatalogIdentity:identity,marketEstimate:price,stockNotice:TEST_STOCK_REASON});
     const result=await tx.insert(tenantMaterials).values({studioId:ctx.studioId,ownerArtistId:input.artistId,name:item.name,category:item.category,unit:item.baseUnit,brand:item.brandName,line:item.lineName,model:item.sku,configuration:item.format,diameter:item.needleDiameter==null?null:String(item.needleDiameter),needleCount:item.needleCount,taper:item.taper,packageQuantity:Number.isInteger(item.unitsPerPackage)?item.unitsPerPackage:null,purchaseUnit:item.purchaseUnit,currentQuantity:stock.quantity,minimumQuantity:stock.minimum,unitCost:price.unitCost,notes,createdByUserId:ctx.user.id});
     const id=Number((result as any)[0].insertId);
     if(!id)throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Não foi possível registrar o saldo de teste.'});
     await tx.insert(tenantInventoryMovements).values({studioId:ctx.studioId,tenantMaterialId:id,type:'entrada',quantity:stock.quantity,previousQuantity:'0.000',newQuantity:stock.quantity,sourceType:TEST_CATALOG_VERSION,sourceId:id,reason:TEST_STOCK_REASON,notes:JSON.stringify({marketEstimate:price,minimumQuantity:stock.minimum}),createdByUserId:ctx.user.id});
     existing.push({id,notes,brand:item.brandName,line:item.lineName,model:item.sku,name:item.name} as typeof existing[number]);
     created++;
   }
   return {nextOffset:end,total:catalog.length,created,preserved,priced,blocked};
 });
}
