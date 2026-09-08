import mysql, { type RowDataPacket } from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function ensureStagingArtistInvitationSchema() {
  if (process.env.RAILWAY_ENVIRONMENT_ID !== '92e8281a-668a-43ed-b2ba-cac84082a91c' || process.env.RAILWAY_SERVICE_ID !== '7527417a-b872-42bf-b828-e0987b805196' || process.env.RUN_DB_MIGRATIONS !== 'true') return;
  const c = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    const [lock] = await c.query<RowDataPacket[]>("SELECT GET_LOCK('podcrm_artist_invitation_schema',30) AS acquired");
    if (Number(lock[0]?.acquired) !== 1) throw new Error('Artist invitation schema lock unavailable.');
    const source = await readFile(resolve(process.cwd(), 'drizzle/0057_artist_invitations.sql'), 'utf8');
    const statements = source.split('\n').filter(l => !l.startsWith('--')).join('\n').split(';').map(s => s.trim()).filter(Boolean);
    for (const statement of statements) {
      if (statement.startsWith('CREATE TABLE IF NOT EXISTS `studio_invitations`')) await c.query(statement);
      else {
        const match = statement.match(/^ALTER TABLE `studio_invitations` ADD COLUMN `(artistId|permissionSnapshot)` /);
        if (!match) throw new Error('Unexpected invitation migration statement.');
        const [columns] = await c.query<RowDataPacket[]>('SHOW COLUMNS FROM `studio_invitations` LIKE ?', [match[1]]);
        if (!columns.length) await c.query(statement);
      }
    }
    console.log('[ArtistInvitations] Schema ready; no invitations sent.');
  } finally { await c.query("SELECT RELEASE_LOCK('podcrm_artist_invitation_schema')"); await c.end(); }
}
