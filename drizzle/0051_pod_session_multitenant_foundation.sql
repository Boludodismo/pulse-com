-- Fundação aditiva para Referência Visual e POD Session SaaS.
-- Não altera nem migra registros das tabelas legadas materials, stock_movements,
-- suppliers, technical_procedures ou procedure_consumables.

CREATE TABLE IF NOT EXISTS material_catalog_categories (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL,
  name VARCHAR(120) NOT NULL,
  icon VARCHAR(80) NULL,
  description TEXT NULL,
  isActive TINYINT NOT NULL DEFAULT 1,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY material_catalog_categories_code_unique (code),
  KEY material_catalog_categories_active_idx (isActive, name)
);

CREATE TABLE IF NOT EXISTS material_catalog_items (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  categoryId INT NOT NULL,
  code VARCHAR(120) NOT NULL,
  name VARCHAR(255) NOT NULL,
  subcategory VARCHAR(120) NULL,
  configuration VARCHAR(120) NULL,
  diameter VARCHAR(40) NULL,
  defaultUnit VARCHAR(50) NOT NULL DEFAULT 'unidade',
  technicalSpecification TEXT NULL,
  icon VARCHAR(80) NULL,
  isActive TINYINT NOT NULL DEFAULT 1,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY material_catalog_items_code_unique (code),
  KEY material_catalog_items_category_idx (categoryId, isActive),
  KEY material_catalog_items_lookup_idx (name, subcategory, configuration)
);

CREATE TABLE IF NOT EXISTS tenant_materials (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  studioId INT NOT NULL,
  catalogItemId INT NULL,
  legacyMaterialId INT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(120) NULL,
  unit VARCHAR(50) NOT NULL DEFAULT 'unidade',
  brand VARCHAR(120) NULL,
  line VARCHAR(120) NULL,
  model VARCHAR(120) NULL,
  configuration VARCHAR(120) NULL,
  diameter VARCHAR(40) NULL,
  currentQuantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  minimumQuantity DECIMAL(12,3) NOT NULL DEFAULT 0,
  unitCost DECIMAL(12,4) NOT NULL DEFAULT 0,
  supplierId INT NULL,
  lot VARCHAR(120) NULL,
  expiresAt DATETIME NULL,
  notes TEXT NULL,
  isActive TINYINT NOT NULL DEFAULT 1,
  createdByUserId INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY tenant_materials_studio_active_idx (studioId, isActive, name),
  KEY tenant_materials_catalog_idx (studioId, catalogItemId),
  KEY tenant_materials_supplier_idx (studioId, supplierId),
  UNIQUE KEY tenant_materials_legacy_source_unique (studioId, legacyMaterialId)
);

CREATE TABLE IF NOT EXISTS tenant_inventory_movements (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  studioId INT NOT NULL,
  tenantMaterialId INT NOT NULL,
  type ENUM('entrada','consumo','reversao','ajuste') NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  previousQuantity DECIMAL(12,3) NOT NULL,
  newQuantity DECIMAL(12,3) NOT NULL,
  sourceType VARCHAR(80) NULL,
  sourceId INT NULL,
  reason VARCHAR(255) NULL,
  notes TEXT NULL,
  createdByUserId INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY tenant_inventory_movements_studio_material_idx (studioId, tenantMaterialId, createdAt),
  KEY tenant_inventory_movements_source_idx (sourceType, sourceId)
);

CREATE TABLE IF NOT EXISTS appointment_planned_materials (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  studioId INT NOT NULL,
  appointmentId INT NOT NULL,
  tenantMaterialId INT NULL,
  catalogItemId INT NULL,
  nameSnapshot VARCHAR(255) NOT NULL,
  unitSnapshot VARCHAR(50) NOT NULL,
  quantityPlanned DECIMAL(12,3) NOT NULL,
  status ENUM('planejado','consumido','nao_utilizado') NOT NULL DEFAULT 'planejado',
  createdByUserId INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY appointment_planned_materials_appointment_idx (studioId, appointmentId, status),
  KEY appointment_planned_materials_material_idx (studioId, tenantMaterialId)
);

CREATE TABLE IF NOT EXISTS procedure_pauses (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  procedureId INT NOT NULL,
  studioId INT NOT NULL,
  artistId INT NULL,
  startedAt DATETIME NOT NULL,
  endedAt DATETIME NULL,
  reason VARCHAR(120) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY procedure_pauses_procedure_idx (procedureId, startedAt),
  KEY procedure_pauses_studio_open_idx (studioId, endedAt)
);

CREATE TABLE IF NOT EXISTS procedure_inventory_consumptions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  procedureId INT NOT NULL,
  studioId INT NOT NULL,
  appointmentId INT NULL,
  clientId INT NOT NULL,
  artistId INT NULL,
  tenantMaterialId INT NOT NULL,
  plannedMaterialId INT NULL,
  nameSnapshot VARCHAR(255) NOT NULL,
  unitSnapshot VARCHAR(50) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unitCostSnapshot DECIMAL(12,4) NOT NULL,
  totalCostSnapshot DECIMAL(12,4) NOT NULL,
  lotSnapshot VARCHAR(120) NULL,
  expiresAtSnapshot DATETIME NULL,
  status ENUM('consumido','revertido') NOT NULL DEFAULT 'consumido',
  consumedAt DATETIME NOT NULL,
  reversedAt DATETIME NULL,
  reversalReason VARCHAR(255) NULL,
  createdByUserId INT NULL,
  reversedByUserId INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY procedure_inventory_consumptions_procedure_idx (procedureId, status, consumedAt),
  KEY procedure_inventory_consumptions_studio_client_idx (studioId, clientId, consumedAt),
  KEY procedure_inventory_consumptions_material_idx (studioId, tenantMaterialId, status)
);

INSERT IGNORE INTO material_catalog_categories (code, name, icon) VALUES
  ('cartridges', 'Cartuchos e Agulhas', 'Syringe'),
  ('inks', 'Tintas e Pigmentos', 'Droplets'),
  ('disposables', 'Descartáveis', 'PackageOpen'),
  ('hygiene', 'Higiene e Limpeza', 'Sparkles'),
  ('protection', 'Proteção e Barreiras', 'ShieldCheck'),
  ('stencil', 'Stencil e Transfer', 'ScanLine'),
  ('aftercare', 'Pós-procedimento', 'HeartPulse'),
  ('other', 'Outros Materiais', 'Box');

INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'needle.rl.03rl.020', 'Cartucho Round Liner', 'Round Liner', '03RL', '0.20', 'unidade', 'Cartucho para traço fino', 'Syringe' FROM material_catalog_categories WHERE code = 'cartridges';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'needle.rl.05rl.030', 'Cartucho Round Liner', 'Round Liner', '05RL', '0.30', 'unidade', 'Cartucho para traço', 'Syringe' FROM material_catalog_categories WHERE code = 'cartridges';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'needle.rl.09rl.030', 'Cartucho Round Liner', 'Round Liner', '09RL', '0.30', 'unidade', 'Cartucho para traço', 'Syringe' FROM material_catalog_categories WHERE code = 'cartridges';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'needle.rs.09rs.030', 'Cartucho Round Shader', 'Round Shader', '09RS', '0.30', 'unidade', 'Cartucho para sombreamento', 'Syringe' FROM material_catalog_categories WHERE code = 'cartridges';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'needle.m1.09m1.030', 'Cartucho Magnum', 'Magnum', '09M1', '0.30', 'unidade', 'Cartucho magnum', 'Syringe' FROM material_catalog_categories WHERE code = 'cartridges';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'needle.cm.15cm.030', 'Cartucho Curved Magnum', 'Curved Magnum', '15CM', '0.30', 'unidade', 'Cartucho curved magnum', 'Syringe' FROM material_catalog_categories WHERE code = 'cartridges';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'ink.black', 'Pigmento Preto', 'Pigmento', 'Preto', NULL, 'ml', 'Pigmento para tatuagem', 'Droplets' FROM material_catalog_categories WHERE code = 'inks';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'ink.white', 'Pigmento Branco', 'Pigmento', 'Branco', NULL, 'ml', 'Pigmento para tatuagem', 'Droplets' FROM material_catalog_categories WHERE code = 'inks';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'disposable.inkcap.small', 'Batoque P', 'Batoque', 'Pequeno', NULL, 'unidade', 'Batoque descartável', 'CircleDot' FROM material_catalog_categories WHERE code = 'disposables';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'disposable.gloves', 'Par de Luvas', 'Luvas', 'Nitrílica', NULL, 'par', 'Luvas descartáveis', 'Hand' FROM material_catalog_categories WHERE code = 'disposables';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'hygiene.greensoap', 'Green Soap', 'Higiene', 'Concentrado', NULL, 'ml', 'Solução de limpeza', 'Bottle' FROM material_catalog_categories WHERE code = 'hygiene';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'hygiene.alcohol70', 'Álcool 70%', 'Higiene', '70%', NULL, 'ml', 'Antisséptico', 'SprayCan' FROM material_catalog_categories WHERE code = 'hygiene';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'hygiene.gauze', 'Gaze', 'Higiene', 'Estéril', NULL, 'unidade', 'Gaze estéril', 'Bandage' FROM material_catalog_categories WHERE code = 'hygiene';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'protection.papertowel', 'Papel Toalha', 'Barreira', 'Folha', NULL, 'folha', 'Papel absorvente', 'Roller' FROM material_catalog_categories WHERE code = 'protection';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'protection.plasticfilm', 'Filme Plástico', 'Barreira', 'Rolo', NULL, 'metro', 'Filme de proteção', 'Roller' FROM material_catalog_categories WHERE code = 'protection';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'protection.vaseline', 'Vaselina / Butter', 'Proteção', 'Pote', NULL, 'ml', 'Barreira de proteção', 'Container' FROM material_catalog_categories WHERE code = 'protection';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'stencil.transfer', 'Stencil / Transfer', 'Decalque', 'Transfer', NULL, 'ml', 'Solução para transferência', 'ScanLine' FROM material_catalog_categories WHERE code = 'stencil';
INSERT IGNORE INTO material_catalog_items (categoryId, code, name, subcategory, configuration, diameter, defaultUnit, technicalSpecification, icon)
SELECT id, 'aftercare.bandage', 'Curativo Pós-procedimento', 'Pós-procedimento', 'Filme', NULL, 'unidade', 'Curativo de proteção', 'HeartPulse' FROM material_catalog_categories WHERE code = 'aftercare';
