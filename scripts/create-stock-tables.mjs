import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  // Criar tabela suppliers
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      cnpj VARCHAR(20),
      contactName VARCHAR(255),
      phone VARCHAR(20),
      whatsapp VARCHAR(20),
      email VARCHAR(255),
      address TEXT,
      notes TEXT,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt BIGINT NOT NULL DEFAULT 0,
      updatedAt BIGINT NOT NULL DEFAULT 0
    )
  `);
  console.log('✓ suppliers criada');

  // Criar tabela materials
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS materials (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      unit VARCHAR(50),
      currentStock DECIMAL(10,2) NOT NULL DEFAULT 0,
      minStock DECIMAL(10,2) NOT NULL DEFAULT 0,
      avgPrice DECIMAL(10,2) NOT NULL DEFAULT 0,
      supplierId INT,
      notes TEXT,
      isActive BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt BIGINT NOT NULL DEFAULT 0,
      updatedAt BIGINT NOT NULL DEFAULT 0,
      FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL
    )
  `);
  console.log('✓ materials criada');

  // Criar tabela stock_movements
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      materialId INT NOT NULL,
      type ENUM('entrada', 'saida', 'ajuste') NOT NULL,
      quantity DECIMAL(10,2) NOT NULL,
      previousStock DECIMAL(10,2) NOT NULL,
      newStock DECIMAL(10,2) NOT NULL,
      reason VARCHAR(255),
      notes TEXT,
      createdBy INT,
      createdAt BIGINT NOT NULL DEFAULT 0,
      FOREIGN KEY (materialId) REFERENCES materials(id) ON DELETE CASCADE
    )
  `);
  console.log('✓ stock_movements criada');

  // Criar tabela purchase_orders
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supplierId INT,
      status ENUM('rascunho', 'enviado', 'confirmado', 'recebido', 'cancelado') NOT NULL DEFAULT 'rascunho',
      notes TEXT,
      totalAmount DECIMAL(10,2),
      sentAt BIGINT,
      createdBy INT,
      createdAt BIGINT NOT NULL DEFAULT 0,
      updatedAt BIGINT NOT NULL DEFAULT 0,
      FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL
    )
  `);
  console.log('✓ purchase_orders criada');

  // Criar tabela purchase_order_items
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderId INT NOT NULL,
      materialId INT,
      materialName VARCHAR(255),
      materialUnit VARCHAR(50),
      quantity DECIMAL(10,2) NOT NULL,
      unitPrice DECIMAL(10,2) NOT NULL DEFAULT 0,
      notes TEXT,
      FOREIGN KEY (orderId) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (materialId) REFERENCES materials(id) ON DELETE SET NULL
    )
  `);
  console.log('✓ purchase_order_items criada');

  await conn.end();
  console.log('\n✅ Todas as tabelas de estoque criadas com sucesso!');
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
