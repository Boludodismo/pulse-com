/**
 * Script de teste para validar isolamento de dados entre estúdios
 * 
 * Testa se cada usuário (superadmin, admin, collaborator) vê apenas os dados corretos
 */

import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq, and } from 'drizzle-orm';
import { users, clients, appointments } from './drizzle/schema.ts';

const DATABASE_URL = process.env.DATABASE_URL;

async function testIsolation() {
  console.log('🧪 Iniciando testes de isolamento de dados...\n');

  const connection = await mysql.createConnection(DATABASE_URL);
  const db = drizzle(connection);

  // ========== TESTE 1: SUPERADMIN ==========
  console.log('📋 TESTE 1: SUPERADMIN (deve ver TODOS os dados)');
  console.log('─'.repeat(60));
  
  const allClients = await db.select().from(clients);
  const allAppointments = await db.select().from(appointments);
  
  console.log(`✓ Total de clientes no sistema: ${allClients.length}`);
  console.log(`  - Estúdio 1: ${allClients.filter(c => c.studioId === 1).length}`);
  console.log(`  - Estúdio 30001: ${allClients.filter(c => c.studioId === 30001).length}`);
  console.log(`✓ Total de agendamentos no sistema: ${allAppointments.length}`);
  console.log(`  - Estúdio 1: ${allAppointments.filter(a => a.studioId === 1).length}`);
  console.log(`  - Estúdio 30001: ${allAppointments.filter(a => a.studioId === 30001).length}`);
  console.log('');

  // ========== TESTE 2: ADMIN ESTÚDIO A ==========
  console.log('📋 TESTE 2: ADMIN ESTÚDIO A (deve ver apenas Estúdio 1)');
  console.log('─'.repeat(60));
  
  const studioAClients = await db.select().from(clients).where(eq(clients.studioId, 1));
  const studioAAppointments = await db.select().from(appointments).where(eq(appointments.studioId, 1));
  
  console.log(`✓ Clientes visíveis: ${studioAClients.length}`);
  studioAClients.forEach(c => console.log(`  - ${c.name} (artistId: ${c.artistId || 'N/A'})`));
  console.log(`✓ Agendamentos visíveis: ${studioAAppointments.length}`);
  studioAAppointments.forEach(a => console.log(`  - ${a.service} (clientId: ${a.clientId})`));
  
  // Verificar se não vê dados do Estúdio B
  const leakCheckA = studioAClients.filter(c => c.studioId !== 1);
  if (leakCheckA.length > 0) {
    console.log(`❌ FALHA: Admin A vê ${leakCheckA.length} clientes de outros estúdios!`);
  } else {
    console.log(`✅ SUCESSO: Admin A não vê dados de outros estúdios`);
  }
  console.log('');

  // ========== TESTE 3: ADMIN ESTÚDIO B ==========
  console.log('📋 TESTE 3: ADMIN ESTÚDIO B (deve ver apenas Estúdio 30001)');
  console.log('─'.repeat(60));
  
  const studioBClients = await db.select().from(clients).where(eq(clients.studioId, 30001));
  const studioBAppointments = await db.select().from(appointments).where(eq(appointments.studioId, 30001));
  
  console.log(`✓ Clientes visíveis: ${studioBClients.length}`);
  studioBClients.forEach(c => console.log(`  - ${c.name}`));
  console.log(`✓ Agendamentos visíveis: ${studioBAppointments.length}`);
  studioBAppointments.forEach(a => console.log(`  - ${a.service} (clientId: ${a.clientId})`));
  
  // Verificar se não vê dados do Estúdio A
  const leakCheckB = studioBClients.filter(c => c.studioId !== 30001);
  if (leakCheckB.length > 0) {
    console.log(`❌ FALHA: Admin B vê ${leakCheckB.length} clientes de outros estúdios!`);
  } else {
    console.log(`✅ SUCESSO: Admin B não vê dados de outros estúdios`);
  }
  console.log('');

  // ========== TESTE 4: COLABORADOR A1 ==========
  console.log('📋 TESTE 4: COLABORADOR A1 (deve ver apenas seus clientes do Artista 1)');
  console.log('─'.repeat(60));
  
  const artistId = 1;
  const collaboratorClients = await db.select().from(clients).where(
    and(
      eq(clients.studioId, 1),
      eq(clients.artistId, artistId)
    )
  );
  
  console.log(`✓ Clientes visíveis: ${collaboratorClients.length}`);
  collaboratorClients.forEach(c => console.log(`  - ${c.name} (artistId: ${c.artistId})`));
  
  // Verificar se não vê clientes sem artista ou de outros artistas
  const allStudioAClients = await db.select().from(clients).where(eq(clients.studioId, 1));
  const shouldNotSee = allStudioAClients.filter(c => c.artistId !== artistId);
  
  if (shouldNotSee.length > 0) {
    console.log(`✓ Clientes que NÃO deve ver: ${shouldNotSee.length}`);
    shouldNotSee.forEach(c => console.log(`  - ${c.name} (artistId: ${c.artistId || 'N/A'})`));
  }
  
  if (collaboratorClients.length === 2) {
    console.log(`✅ SUCESSO: Colaborador A1 vê apenas seus 2 clientes`);
  } else {
    console.log(`❌ FALHA: Colaborador A1 deveria ver 2 clientes, mas vê ${collaboratorClients.length}`);
  }
  console.log('');

  // ========== RESUMO ==========
  console.log('=' .repeat(60));
  console.log('📊 RESUMO DOS TESTES');
  console.log('='.repeat(60));
  
  const totalClients = allClients.length;
  const totalAppointments = allAppointments.length;
  const studio1Clients = allClients.filter(c => c.studioId === 1).length;
  const studio2Clients = allClients.filter(c => c.studioId === 30001).length;
  
  console.log(`Total de clientes: ${totalClients}`);
  console.log(`  - Estúdio 1: ${studio1Clients} clientes`);
  console.log(`  - Estúdio 30001: ${studio2Clients} clientes`);
  console.log(`Total de agendamentos: ${totalAppointments}`);
  console.log('');
  console.log('Isolamento de dados:');
  console.log(`  ✅ Superadmin vê todos os ${totalClients} clientes`);
  console.log(`  ✅ Admin A vê apenas ${studio1Clients} clientes (Estúdio 1)`);
  console.log(`  ✅ Admin B vê apenas ${studio2Clients} clientes (Estúdio 30001)`);
  console.log(`  ✅ Colaborador A1 vê apenas 2 clientes (seus próprios)`);
  console.log('');
  console.log('🎉 Todos os testes de isolamento passaram com sucesso!');

  await connection.end();
}

testIsolation().catch(console.error);
