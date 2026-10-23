import { readFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
export function normalizeSql(statement) {
  let s = statement.replace(/DEFAULT\s+'CURRENT_TIMESTAMP'/gi, 'DEFAULT CURRENT_TIMESTAMP');
  if (/^CREATE TABLE/i.test(s) && /AUTO_INCREMENT/.test(s) && !/PRIMARY KEY/.test(s)) {
    s = s.replace(/(`[^`]+`[^,\n]*AUTO_INCREMENT[^,\n]*)/, '$1 PRIMARY KEY');
  }
  return s;
}
export async function initialize(connection, password) {
  const [tables] = await connection.query('SHOW TABLES');
  if (tables.length) throw new Error('DEMO_REQUIRES_EMPTY_NEW_DATABASE');
  const raw = await readFile(new URL('./schema/0000_synthetic.sql', import.meta.url), 'utf8');
  for (const part of raw.split('--> statement-breakpoint')) {
    const sql = normalizeSql(part.trim().replace(/;$/, ''));
    if (sql) await connection.query(sql);
  }
  await connection.execute('INSERT INTO studios (id,name,email,masterKey) VALUES (1,?,?,?)', ['Estudio Ficticio - TESTE', 'estudio@example.invalid', randomBytes(32).toString('hex')]);
  await connection.execute('INSERT INTO users (id,openId,name,email,role,studioId,passwordHash) VALUES (1,?,?,?,?,1,?)', ['demo-owner','Administrador de Teste','demo@example.invalid','superadmin',await bcrypt.hash(password,12)]);
  await connection.execute('INSERT INTO studioSettings (studioId,studioName,email,enableBirthdayReminders,enableAppointmentReminders) VALUES (1,?,?,0,0)', ['Estudio Ficticio - TESTE','estudio@example.invalid']);
  for (let i=1;i<=2;i++) await connection.execute('INSERT INTO artists (id,name,email,color,studioId) VALUES (?,?,?,?,1)', [i,'Artista Ficticio '+i,'artista'+i+'@example.invalid',i===1?'#8b5cf6':'#0ea5e9']);
  for (let i=1;i<=6;i++) await connection.execute('INSERT INTO clients (name,email,studioId) VALUES (?,?,1)', ['Cliente Ficticio '+String(i).padStart(2,'0'),'cliente'+i+'@example.invalid']);
  await connection.execute('INSERT INTO calendars (userId,name,isDefault) VALUES (1,?,1)', ['Agenda de Teste']);
  for (let i=1;i<=3;i++) {
    const at = new Date(Date.now()+i*86400000); const date = at.toISOString().slice(0,10)+' 14:00:00';
    await connection.execute('INSERT INTO appointments (clientId,calendarId,date,duration,service,artist,artistId,studioId,attendanceEnabled) VALUES (?,1,?,60,?,?,1,1,0)', [i,date,'Tatuagem de Teste','Artista Ficticio 1']);
  }
  for (const [name,category,unit,quantity,cost] of [['Cartucho ficticio','Cartuchos','unidade',20,4],['Tinta preta ficticia','Tintas','ml',30,2],['Batoque ficticio','Descartaveis','unidade',100,0.2]]) {
    const [material] = await connection.execute('INSERT INTO tenant_materials (studioId,name,category,unit,currentQuantity,minimumQuantity,unitCost,createdByUserId) VALUES (1,?,?,?,?,5,?,1)',[name,category,unit,quantity,cost]);
    // Explicit fictional studio-stock allocations, using the existing permission model.
    // Real materials are never modified or implicitly shared by this demo bootstrap.
    for (const artistId of [1,2]) await connection.execute('INSERT INTO studio_material_artists(studioId,tenantMaterialId,artistId) VALUES(1,?,?)',[material.insertId,artistId]);
  }
  console.log('[Demo] Esquema novo e dados sinteticos preparados.');
}
