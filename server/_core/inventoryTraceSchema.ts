import mysql,{type Connection,type RowDataPacket} from 'mysql2/promise';
export async function upgradeInventoryTrace(c:Connection){
 const [lock]=await c.query<RowDataPacket[]>("SELECT GET_LOCK('tatuei_inventory_trace',30) acquired");
 if(Number(lock[0]?.acquired)!==1)throw new Error('Inventory migration lock unavailable');
 try{
  for(const [table,columns] of Object.entries({tenant_materials:{needleCount:'INT NULL',gauge:'VARCHAR(20) NULL',taper:'VARCHAR(80) NULL',packageQuantity:'INT NULL',purchaseUnit:'VARCHAR(50) NULL'},procedure_inventory_consumptions:{batchId:'INT NULL',supplierNameSnapshot:'VARCHAR(255) NULL',technicalSnapshot:'TEXT NULL'}})){
   const [existing]=await c.query<RowDataPacket[]>(`SHOW COLUMNS FROM ${table}`);
   for(const [name,type] of Object.entries(columns))if(!existing.some(row=>row.Field===name))await c.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${type}`);
  }
  await c.query(`CREATE TABLE IF NOT EXISTS inventory_batches (
   id INT AUTO_INCREMENT PRIMARY KEY,studioId INT NOT NULL,tenantMaterialId INT NOT NULL,receiptKey VARCHAR(36) NOT NULL,
   nameSnapshot VARCHAR(255) NOT NULL,unitSnapshot VARCHAR(50) NOT NULL,technicalSnapshot TEXT NOT NULL,
   lot VARCHAR(120) NOT NULL,supplierId INT NOT NULL,supplierName VARCHAR(255) NOT NULL,expiresAt DATETIME NULL,
   receivedQuantity DECIMAL(12,3) NOT NULL,remainingQuantity DECIMAL(12,3) NOT NULL,unitCost DECIMAL(12,4) NOT NULL,
   receivedAt DATETIME NOT NULL,createdByUserId INT NOT NULL,
   UNIQUE KEY inventory_batch_receipt_unique(studioId,receiptKey),KEY inventory_batch_material_idx(studioId,tenantMaterialId)
  ) ENGINE=InnoDB`);
 }finally{await c.query("SELECT RELEASE_LOCK('tatuei_inventory_trace')")}
}
export async function ensureInventoryTraceSchema(){
 if(!process.env.DATABASE_URL)return;
 const c=await mysql.createConnection(process.env.DATABASE_URL);
 try{await upgradeInventoryTrace(c);console.log('[Inventory] Lot traceability schema ready; existing balances preserved.')}finally{await c.end()}
}
