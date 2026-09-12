import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [cols] = await conn.execute(`SHOW COLUMNS FROM studioSettings`);
console.log('Colunas studioSettings:');
cols.forEach(c => console.log(' -', c.Field));
await conn.end();
