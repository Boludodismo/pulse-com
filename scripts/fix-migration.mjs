import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const conn = await mysql.createConnection(DATABASE_URL);

// Verificar se as colunas já existem
const [cols] = await conn.execute(`
  SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'studioSettings'
  AND COLUMN_NAME IN ('reminderDaysBefore', 'reminderSendTime', 'reminderResend', 'reminderResendTime')
`);
console.log('Colunas existentes:', cols.map(c => c.COLUMN_NAME));

// Verificar se a migração 0023 já está registrada
const [migrations] = await conn.execute(`SELECT * FROM __drizzle_migrations WHERE hash LIKE '%0023%' OR hash LIKE '%cooing%'`);
console.log('Migração 0023 registrada:', migrations.length > 0 ? 'SIM' : 'NÃO');

// Verificar o nome exato da migração
const [allMigrations] = await conn.execute(`SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5`);
console.log('Últimas migrações:', allMigrations.map(m => ({ hash: m.hash?.slice(0, 20), created_at: m.created_at })));

await conn.end();
