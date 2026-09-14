import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";

export async function upgradeInventoryWorkflow(connection: Connection) {
  const [lock] = await connection.query<RowDataPacket[]>(
    "SELECT GET_LOCK('tatuei_inventory_workflow', 30) AS acquired"
  );
  if (Number(lock[0]?.acquired) !== 1)
    throw new Error("Inventory workflow migration lock unavailable");
  try {
    // Additive tables only. No existing balance, ownership or payment is rewritten.
    await connection.query(`CREATE TABLE IF NOT EXISTS inventory_loans (
      id INT AUTO_INCREMENT PRIMARY KEY, studioId INT NOT NULL, requestKey VARCHAR(36) NOT NULL,
      lenderArtistId INT NULL, borrowerArtistId INT NOT NULL, appointmentId INT NULL,
      sourceMaterialId INT NOT NULL, sourceBatchId INT NULL, receivedMaterialId INT NULL, receivedBatchId INT NULL,
      materialName VARCHAR(255) NOT NULL, unit VARCHAR(50) NOT NULL, specification TEXT NOT NULL,
      quantityRequested DECIMAL(12,3) NOT NULL, quantityApproved DECIMAL(12,3) NULL, quantitySettled DECIMAL(12,3) NOT NULL DEFAULT 0,
      status VARCHAR(24) NOT NULL DEFAULT 'requested', dueAt DATETIME NULL, reminderHours INT NOT NULL DEFAULT 24,
      notes TEXT NULL, decisionNotes TEXT NULL, createdByUserId INT NOT NULL, approvedByUserId INT NULL, deliveredByUserId INT NULL,
      approvedAt DATETIME NULL, deliveredAt DATETIME NULL, settledAt DATETIME NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY inventory_loan_request_unique(studioId,requestKey), UNIQUE KEY inventory_loan_received_unique(studioId,receivedMaterialId),
      KEY inventory_loan_due_idx(status,dueAt), KEY inventory_loan_parties_idx(studioId,borrowerArtistId,lenderArtistId)
    ) ENGINE=InnoDB`);
    await connection.query(`CREATE TABLE IF NOT EXISTS inventory_loan_events (
      id INT AUTO_INCREMENT PRIMARY KEY, studioId INT NOT NULL, loanId INT NOT NULL, operationKey VARCHAR(36) NOT NULL,
      kind VARCHAR(32) NOT NULL, quantity DECIMAL(12,3) NULL, sourceMaterialId INT NULL, sourceBatchId INT NULL, targetBatchId INT NULL,
      notes TEXT NULL, createdByUserId INT NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY inventory_loan_event_unique(studioId,operationKey), KEY inventory_loan_event_idx(studioId,loanId,id)
    ) ENGINE=InnoDB`);
    await connection.query(`CREATE TABLE IF NOT EXISTS inventory_notices (
      id INT AUTO_INCREMENT PRIMARY KEY, studioId INT NOT NULL, recipientArtistId INT NULL, recipientKey VARCHAR(40) NOT NULL,
      eventKey VARCHAR(180) NOT NULL, kind VARCHAR(32) NOT NULL, severity VARCHAR(12) NOT NULL,
      appointmentId INT NULL, materialId INT NULL, loanId INT NULL, title VARCHAR(255) NOT NULL, message TEXT NOT NULL,
      readAt DATETIME NULL, resolvedAt DATETIME NULL, deliveryStatus VARCHAR(24) NOT NULL DEFAULT 'pending', attempts INT NOT NULL DEFAULT 0,
      lastError VARCHAR(500) NULL, nextAttemptAt DATETIME NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY inventory_notice_event_unique(studioId,recipientKey,eventKey),
      KEY inventory_notice_recipient_idx(studioId,recipientKey,id), KEY inventory_notice_delivery_idx(deliveryStatus,nextAttemptAt)
    ) ENGINE=InnoDB`);
    await connection.query(`CREATE TABLE IF NOT EXISTS inventory_alert_preferences (
      id INT AUTO_INCREMENT PRIMARY KEY, studioId INT NOT NULL, recipientKey VARCHAR(40) NOT NULL,
      leadHours INT NOT NULL DEFAULT 48, whatsappEnabled INT NOT NULL DEFAULT 0,
      whatsappOptedInAt DATETIME NULL, updatedByUserId INT NOT NULL,
      UNIQUE KEY inventory_alert_preference_unique(studioId,recipientKey)
    ) ENGINE=InnoDB`);
  } finally {
    await connection.query("SELECT RELEASE_LOCK('tatuei_inventory_workflow')");
  }
}
export async function ensureInventoryWorkflowSchema() {
  if (!process.env.DATABASE_URL) return;
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await upgradeInventoryWorkflow(connection);
  } finally {
    await connection.end();
  }
}
