import { createConnection } from "mysql2/promise";
import { config } from "dotenv";
config();

const conn = await createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute("SHOW COLUMNS FROM clients LIKE 'doc%'");
console.log("Colunas doc* no banco:", rows);
await conn.end();
