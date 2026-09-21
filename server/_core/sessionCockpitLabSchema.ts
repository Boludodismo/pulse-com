import mysql, { type RowDataPacket } from "mysql2/promise";

const STAGING_ENVIRONMENT_ID = "92e8281a-668a-43ed-b2ba-cac84082a91c";
const COCKPIT_LAB_SERVICE_ID = "f17e5b40-9bae-4b84-a4c5-72e4e91b8cbf";

/**
 * Additive schema used only by the isolated Cockpit V2 laboratory.
 * It is deliberately blocked outside the known staging environment/service.
 */
export async function ensureSessionCockpitLabSchema() {
  if (
    process.env.SESSION_COCKPIT_LAB_SCHEMA !== "true" ||
    process.env.RAILWAY_ENVIRONMENT_ID !== STAGING_ENVIRONMENT_ID ||
    process.env.RAILWAY_SERVICE_ID !== COCKPIT_LAB_SERVICE_ID
  ) return;
  if (!process.env.DATABASE_URL) throw new Error("Database required for Cockpit V2 lab.");

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [lock] = await connection.query<RowDataPacket[]>(
      "SELECT GET_LOCK('tatuei_session_cockpit_v2_lab',30) AS acquired"
    );
    if (Number(lock[0]?.acquired) !== 1)
      throw new Error("Cockpit V2 lab schema lock unavailable.");

    await connection.query(`CREATE TABLE IF NOT EXISTS procedure_color_samples (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      studioId INT NOT NULL,
      procedureId INT NOT NULL,
      clientId INT NOT NULL,
      artistId INT NULL,
      code VARCHAR(16) NOT NULL,
      hex VARCHAR(9) NOT NULL,
      red INT NOT NULL,
      green INT NOT NULL,
      blue INT NOT NULL,
      cyan INT NOT NULL,
      magenta INT NOT NULL,
      yellow INT NOT NULL,
      black INT NOT NULL,
      xPct DECIMAL(7,4) NOT NULL,
      yPct DECIMAL(7,4) NOT NULL,
      sampleSize INT NOT NULL DEFAULT 5,
      createdByUserId INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY procedure_color_sample_code_unique(studioId,procedureId,code),
      KEY procedure_color_samples_procedure_idx(studioId,procedureId,id)
    ) ENGINE=InnoDB`);

    await connection.query(`CREATE TABLE IF NOT EXISTS procedure_ink_recipes (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      studioId INT NOT NULL,
      procedureId INT NOT NULL,
      clientId INT NOT NULL,
      artistId INT NULL,
      sampleId INT NULL,
      code VARCHAR(16) NOT NULL,
      cupSize VARCHAR(8) NOT NULL,
      cupCapacityMl DECIMAL(8,3) NOT NULL,
      dropsPerMl DECIMAL(8,3) NOT NULL,
      totalDrops INT NOT NULL,
      estimatedMl DECIMAL(8,3) NOT NULL,
      cupTenantMaterialId INT NULL,
      cupConsumptionId INT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'active',
      createdByUserId INT NOT NULL,
      revertedAt DATETIME NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY procedure_ink_recipe_code_unique(studioId,procedureId,code),
      KEY procedure_ink_recipes_procedure_idx(studioId,procedureId,id),
      KEY procedure_ink_recipes_sample_idx(studioId,sampleId)
    ) ENGINE=InnoDB`);

    await connection.query(`CREATE TABLE IF NOT EXISTS procedure_ink_recipe_items (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      studioId INT NOT NULL,
      recipeId INT NOT NULL,
      tenantMaterialId INT NOT NULL,
      consumptionId INT NOT NULL,
      batchId INT NULL,
      nameSnapshot VARCHAR(255) NOT NULL,
      brandSnapshot VARCHAR(120) NULL,
      lotSnapshot VARCHAR(120) NULL,
      expiresAtSnapshot DATETIME NULL,
      drops INT NOT NULL,
      estimatedMl DECIMAL(8,3) NOT NULL,
      percentage DECIMAL(7,3) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY procedure_ink_recipe_items_recipe_idx(studioId,recipeId,id),
      KEY procedure_ink_recipe_items_consumption_idx(studioId,consumptionId)
    ) ENGINE=InnoDB`);

    await connection.query(`CREATE TABLE IF NOT EXISTS tenant_material_color_samples (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      studioId INT NOT NULL,
      tenantMaterialId INT NOT NULL,
      artistId INT NULL,
      source VARCHAR(24) NOT NULL DEFAULT 'photo',
      hex VARCHAR(9) NOT NULL,
      red INT NOT NULL,
      green INT NOT NULL,
      blue INT NOT NULL,
      cyan INT NOT NULL,
      magenta INT NOT NULL,
      yellow INT NOT NULL,
      black INT NOT NULL,
      labL DECIMAL(7,3) NOT NULL,
      labA DECIMAL(7,3) NOT NULL,
      labB DECIMAL(7,3) NOT NULL,
      createdByUserId INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY tenant_material_color_sample_unique(studioId,tenantMaterialId),
      KEY tenant_material_color_samples_artist_idx(studioId,artistId)
    ) ENGINE=InnoDB`);

    await connection.query(`CREATE TABLE IF NOT EXISTS procedure_ink_recipe_results (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      studioId INT NOT NULL,
      recipeId INT NOT NULL,
      procedureId INT NOT NULL,
      clientId INT NOT NULL,
      artistId INT NULL,
      hex VARCHAR(9) NOT NULL,
      red INT NOT NULL,
      green INT NOT NULL,
      blue INT NOT NULL,
      cyan INT NOT NULL,
      magenta INT NOT NULL,
      yellow INT NOT NULL,
      black INT NOT NULL,
      labL DECIMAL(7,3) NOT NULL,
      labA DECIMAL(7,3) NOT NULL,
      labB DECIMAL(7,3) NOT NULL,
      note VARCHAR(500) NULL,
      createdByUserId INT NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY procedure_ink_recipe_result_unique(studioId,recipeId),
      KEY procedure_ink_recipe_results_artist_idx(studioId,artistId,id),
      KEY procedure_ink_recipe_results_procedure_idx(studioId,procedureId,id)
    ) ENGINE=InnoDB`);

    const [columns] = await connection.query<RowDataPacket[]>(
      "SHOW COLUMNS FROM procedure_inventory_consumptions LIKE 'recipeId'"
    );
    if (!columns.length) {
      await connection.query(
        "ALTER TABLE procedure_inventory_consumptions ADD COLUMN recipeId INT NULL AFTER plannedMaterialId"
      );
      await connection.query(
        "ALTER TABLE procedure_inventory_consumptions ADD KEY procedure_inventory_consumptions_recipe_idx (studioId,recipeId,status)"
      );
    }

    console.log("[Cockpit V2 Lab] Color samples and ink recipe schema ready.");
  } finally {
    await connection
      .query("SELECT RELEASE_LOCK('tatuei_session_cockpit_v2_lab')")
      .catch(() => undefined);
    await connection.end();
  }
}
