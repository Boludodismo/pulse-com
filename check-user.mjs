import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './drizzle/schema.js';
import { eq } from 'drizzle-orm';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(conn, { schema, mode: 'default' });
  const users = await db.select().from(schema.users).where(eq(schema.users.id, 1));
  console.log('User 1:', JSON.stringify(users[0], null, 2));
  await conn.end();
}
main().catch(console.error);
