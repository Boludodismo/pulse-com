import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const conn = await mysql.createConnection(DATABASE_URL);

// Ler o arquivo de migração e calcular o hash
const migrationContent = readFileSync('/home/ubuntu/tattoo_crm/drizzle/0023_cooing_wrecking_crew.sql', 'utf8');
const hash = createHash('sha256').update(migrationContent).digest('hex').slice(0, 20);
console.log('Hash calculado:', hash);

// Inserir o registro da migração
await conn.execute(
  `INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)`,
  [hash, Date.now()]
);
console.log('Migração 0023 registrada com sucesso!');

await conn.end();
