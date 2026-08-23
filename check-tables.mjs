import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [tables] = await conn.query("SHOW TABLES");
console.log("Tabelas existentes:");
tables.forEach(t => console.log(" -", Object.values(t)[0]));
await conn.end();
