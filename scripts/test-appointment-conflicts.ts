/** Only synthetic data in the disposable local CI database. */
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import {checkAppointmentConflicts} from '../server/db';

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(process.env.CI, 'true');
  assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname));
  assert.equal(url.pathname, '/supplier_test');
  const root = await mysql.createConnection(url.toString());
  await root.query('CREATE DATABASE appointment_conflict_test CHARACTER SET utf8mb4');
  await root.end();
  url.pathname = '/appointment_conflict_test';
  process.env.DATABASE_URL = url.toString();
  const c = await mysql.createConnection(url.toString());
  await c.query('CREATE TABLE clients(id INT PRIMARY KEY, studioId INT, name VARCHAR(255))');
  await c.query('CREATE TABLE appointments(id INT PRIMARY KEY, studioId INT, clientId INT, date DATETIME, duration INT, service VARCHAR(255), artist VARCHAR(255), status VARCHAR(40))');
  await c.query("INSERT INTO clients VALUES(1,101,'Cliente do estúdio'),(2,202,'Cliente de outro estúdio')");
  const fixtures = [
    [1,101,1,'2026-09-11 23:45:00',120,'Sessão na madrugada','Artista Exemplo','agendado'],
    [2,101,1,'2026-09-12 14:00:00',180,'Sessão à tarde','Artista Exemplo','agendado'],
    [3,101,1,'2026-09-12 01:00:00',60,'Outro artista','Artista Diferente','agendado'],
    [4,202,2,'2026-09-12 01:00:00',60,'Outro estúdio','Artista Exemplo','agendado'],
    [5,101,1,'2026-09-12 01:00:00',60,'Cancelada','Artista Exemplo','cancelado'],
    [6,101,1,'2026-09-12 00:05:00',60,'Termina no início','Artista Exemplo','agendado'],
    [7,101,1,'2026-09-12 02:05:00',60,'Começa no término','Artista Exemplo','agendado'],
    [8,101,2,'2026-09-13 01:00:00',60,'Vínculo legado inválido','Artista Exemplo','agendado'],
  ];
  for (const row of fixtures) await c.execute('INSERT INTO appointments VALUES(?,?,?,?,?,?,?,?)', row);
  const result = await checkAppointmentConflicts('Artista Exemplo','2026-09-12 01:05:00',60,undefined,101);
  assert.equal(result.hasConflict,true);
  assert.deepEqual(result.conflicts.map(item=>item.id),[1]);
  assert.equal(result.conflicts[0].clientName,'Cliente do estúdio');
  assert.equal(result.conflicts[0].date,'2026-09-11 23:45:00');
  assert.equal((await checkAppointmentConflicts('Artista Exemplo','2026-09-12 01:05:00',60,1,101)).hasConflict,false);
  assert.equal((await checkAppointmentConflicts('Artista Exemplo','2026-09-12 03:05:00',60,undefined,101)).hasConflict,false);
  const foreign = await checkAppointmentConflicts('Artista Exemplo','2026-09-13 01:05:00',60,undefined,101);
  assert.equal(foreign.conflicts[0].clientName,null);
  await assert.rejects(checkAppointmentConflicts('Artista Exemplo','2026-09-12 01:05:00',60));
  await c.end();
  console.log('PASS: actual MySQL conflict query, midnight overlap, touching intervals, cancelled appointments, edit exclusion and tenant isolation');
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1)});
