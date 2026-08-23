/**
 * SEED DE DEMONSTRAÇÃO - POD CRM (versão batch otimizada)
 * 6+ meses de histórico com receita acima de R$250.000/mês
 */
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL não encontrada'); process.exit(1); }

const conn = await mysql.createConnection(DATABASE_URL);
console.log('✅ Conectado ao banco de dados');

const STUDIO_ID = 1;
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const fmt = d => d.toISOString().slice(0, 19).replace('T', ' ');
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const addMonths = (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; };

// ── Limpar dados de seed anteriores (manter usuários e configurações) ──
console.log('🧹 Limpando dados de seed anteriores...');
await conn.execute(`DELETE FROM transactions WHERE studioId = ? AND id > 6`, [STUDIO_ID]);
await conn.execute(`DELETE FROM appointments WHERE studioId = ? AND id > 14`, [STUDIO_ID]);
await conn.execute(`DELETE FROM clientNotes WHERE clientId IN (SELECT id FROM clients WHERE studioId = ? AND id > 13)`, [STUDIO_ID]);
await conn.execute(`DELETE FROM clients WHERE studioId = ? AND id > 13`, [STUDIO_ID]);
await conn.execute(`DELETE FROM artists WHERE studioId = ? AND id > 3`, [STUDIO_ID]);

// ── 1. ARTISTAS ──
console.log('🎨 Inserindo artistas...');
const artistsData = [
  ['Rafael Mendes', 'rafael@podtattoo.com.br', '11991230001', '@rafaelmendes_tattoo', 'Realismo e Retrato', 'Especialista em realismo fotográfico com 10 anos de experiência. Referência nacional em retratos em preto e cinza.'],
  ['Juliana Costa', 'juliana@podtattoo.com.br', '11991230002', '@jucosta_ink', 'Aquarela e Fine Line', 'Artista especializada em aquarela e traços delicados. Trabalhos únicos com paletas de cores vibrantes.'],
  ['Bruno Oliveira', 'bruno@podtattoo.com.br', '11991230003', '@brunooliveira_tattoo', 'Old School e Neo Traditional', 'Mestre em Old School americano e Neo Traditional. Mais de 15 anos tatuando com estilo inconfundível.'],
  ['Camila Ferreira', 'camila@podtattoo.com.br', '11991230004', '@camilaferreira_ink', 'Geométrico e Mandala', 'Especialista em geometria sagrada e mandalas. Precisão matemática em cada traço.'],
  ['Diego Santos', 'diego@podtattoo.com.br', '11991230005', '@diegosantos_tattoo', 'Blackwork e Tribal', 'Referência em blackwork contemporâneo e tribal moderno. Trabalhos marcantes e atemporais.'],
  ['Fernanda Lima', 'fernanda@podtattoo.com.br', '11991230006', '@fernandalima_ink', 'Japonês e Oriental', 'Especialista em tatuagem japonesa tradicional e oriental. Domínio em Irezumi e Tebori.'],
  ['Gustavo Alves', 'gustavo@podtattoo.com.br', '11991230007', '@gustavoalves_tattoo', 'Lettering e Caligrafia', 'Artista especializado em lettering artístico e caligrafia. Frases e textos com beleza e significado.'],
  ['Isabela Rocha', 'isabela@podtattoo.com.br', '11991230008', '@isabelarocha_ink', 'Minimalista e Micro', 'Especialista em micro tatuagens e minimalismo. Detalhes incríveis em pequenos formatos.'],
];

for (const a of artistsData) {
  await conn.execute(
    `INSERT INTO artists (name, email, phone, instagram, specialty, bio, active, studioId, createdAt, updatedAt) VALUES (?,?,?,?,?,?,1,?,NOW(),NOW())`,
    [...a, STUDIO_ID]
  );
}
const [artistRows] = await conn.execute(`SELECT id, name FROM artists WHERE studioId = ? ORDER BY id`, [STUDIO_ID]);
console.log(`✅ ${artistRows.length} artistas`);

// ── 2. CLIENTES (60) ──
console.log('👥 Inserindo 60 clientes...');
const firstNames = ['Ana','Carlos','Mariana','Pedro','Fernanda','Lucas','Beatriz','Gabriel','Larissa','Thiago',
  'Camila','Rodrigo','Letícia','Felipe','Amanda','Matheus','Priscila','Vinicius','Juliana','Eduardo',
  'Natália','André','Renata','Guilherme','Patrícia','Leonardo','Vanessa','Rafael','Daniela','Henrique',
  'Sabrina','Marcos','Aline','Diego','Tatiana','Bruno','Cristina','Alexandre','Mônica','Leandro',
  'Carla','Fábio','Simone','Renan','Débora','Cauã','Érica','Murilo','Luana','Sérgio',
  'Bianca','Otávio','Viviane','Caio','Raquel','Igor','Melissa','Davi','Elisa','Márcio'];
const lastNames = ['Silva','Santos','Oliveira','Souza','Rodrigues','Ferreira','Alves','Pereira','Lima','Gomes',
  'Costa','Ribeiro','Martins','Carvalho','Araújo','Melo','Barbosa','Rocha','Cardoso','Nascimento'];
const cities = ['São Paulo','Rio de Janeiro','Belo Horizonte','Curitiba','Porto Alegre','Salvador','Fortaleza','Recife'];
const states = ['SP','RJ','MG','PR','RS','BA','CE','PE'];
const genders = ['Homem','Mulher','Outros'];
const now = new Date();

const clientBatch = [];
for (let i = 0; i < 60; i++) {
  const fn = firstNames[i];
  const ln = pick(lastNames);
  const ci = i % cities.length;
  const by = rand(1978, 2003);
  const bm = String(rand(1,12)).padStart(2,'0');
  const bd = String(rand(1,28)).padStart(2,'0');
  const loyalty = i < 12 ? 'Ouro' : i < 28 ? 'Prata' : 'Bronze';
  const spent = loyalty === 'Ouro' ? rand(1200000, 5000000) : loyalty === 'Prata' ? rand(300000, 1199999) : rand(50000, 299999);
  const apptCnt = loyalty === 'Ouro' ? rand(10, 35) : loyalty === 'Prata' ? rand(4, 9) : rand(1, 3);
  const createdAt = fmt(addDays(now, -rand(10, 210)));
  const artistId = artistRows[i % artistRows.length].id;
  clientBatch.push([
    `${fn} ${ln}`,
    `${fn.toLowerCase().replace(/[^a-z]/g,'')}${i}@email.com`,
    `119${rand(80000000,99999999)}`,
    `${by}-${bm}-${bd} 00:00:00`,
    `@${fn.toLowerCase().replace(/[^a-z]/g,'')}_ink`,
    cities[ci], states[ci], pick(genders),
    spent, apptCnt, loyalty, artistId, STUDIO_ID, createdAt
  ]);
}

// Inserção em lote de clientes
for (const c of clientBatch) {
  await conn.execute(
    `INSERT INTO clients (name,email,phone,birthDate,instagram,city,state,gender,totalSpent,appointmentCount,loyaltyLevel,artistId,studioId,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
    c
  );
}
const [clientRows] = await conn.execute(`SELECT id FROM clients WHERE studioId = ? ORDER BY id DESC LIMIT 60`, [STUDIO_ID]);
const clientIds = clientRows.map(r => r.id);
console.log(`✅ ${clientIds.length} clientes`);

// ── 3. AGENDAMENTOS + TRANSAÇÕES (batch) ──
console.log('📅 Gerando agendamentos e transações em lote...');

const services = [
  ['Tatuagem Pequena (até 10cm)', 35000, 80000, 90],
  ['Tatuagem Média (10-20cm)', 80000, 180000, 180],
  ['Tatuagem Grande (20-40cm)', 180000, 350000, 300],
  ['Manga Completa', 350000, 800000, 420],
  ['Costas Completas', 400000, 900000, 420],
  ['Retoque e Correção', 20000, 60000, 60],
  ['Cover Up', 150000, 400000, 240],
  ['Sessão de Realismo', 200000, 500000, 300],
  ['Fine Line Delicado', 25000, 90000, 60],
  ['Mandala Geométrica', 120000, 280000, 240],
];
const payMethods = ['pix','pix','pix','credito','credito','debito','dinheiro','transferencia'];

const apptValues = [];
const txValues = [];

for (let mo = -6; mo <= 0; mo++) {
  const mStart = addMonths(now, mo);
  mStart.setDate(1); mStart.setHours(0,0,0,0);
  const mEnd = new Date(mStart.getFullYear(), mStart.getMonth()+1, 0);
  const daysInMonth = mEnd.getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const cur = new Date(mStart); cur.setDate(day);
    if (cur.getDay() === 0) continue; // skip domingo
    if (cur > now) continue;

    const isSat = cur.getDay() === 6;
    const count = isSat ? rand(8,12) : rand(15,22);
    const hours = [9,9,10,10,11,11,12,13,13,14,14,15,15,16,16,17,17,18,18,19];

    for (let a = 0; a < count; a++) {
      const clientId = pick(clientIds);
      const artist = pick(artistRows);
      const [svcName, svcMin, svcMax, svcDur] = pick(services);
      const h = hours[a % hours.length];
      const m = pick([0,15,30]);
      const apptDate = new Date(cur); apptDate.setHours(h,m,0,0);

      const status = mo < 0
        ? (Math.random() < 0.87 ? 'concluido' : Math.random() < 0.6 ? 'confirmado' : 'cancelado')
        : (Math.random() < 0.5 ? 'agendado' : 'confirmado');

      const total = rand(svcMin, svcMax);
      const deposit = Math.floor(total * 0.3);
      const depPaid = Math.random() < 0.8 ? 1 : 0;
      const dateStr = fmt(apptDate);

      apptValues.push([clientId, dateStr, svcDur, svcName, artist.name, status,
        `Sessão de ${svcName.toLowerCase()} com ${artist.name}.`,
        depPaid, deposit, total, STUDIO_ID, dateStr]);

      if (status === 'concluido') {
        txValues.push([clientId, 'entrada', 'Tatuagem',
          `Pagamento - ${svcName} com ${artist.name}`,
          total, pick(payMethods), dateStr, STUDIO_ID, dateStr]);
      } else if (status === 'confirmado' && depPaid) {
        txValues.push([clientId, 'entrada', 'Sinal/Depósito',
          `Sinal - ${svcName} com ${artist.name}`,
          deposit, 'pix', dateStr, STUDIO_ID, dateStr]);
      }
    }
  }
}

// Inserir agendamentos em lotes de 200
console.log(`  Inserindo ${apptValues.length} agendamentos em lotes...`);
const BATCH = 200;
for (let i = 0; i < apptValues.length; i += BATCH) {
  const chunk = apptValues.slice(i, i + BATCH);
  const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
  await conn.execute(
    `INSERT INTO appointments (clientId,date,duration,service,artist,status,notes,depositPaid,depositAmount,totalAmount,studioId,createdAt) VALUES ${placeholders}`,
    chunk.flat()
  );
  process.stdout.write(`\r  Agendamentos: ${Math.min(i+BATCH, apptValues.length)}/${apptValues.length}`);
}
console.log('\n  ✅ Agendamentos inseridos');

// Inserir transações em lotes de 200
console.log(`  Inserindo ${txValues.length} transações em lotes...`);
for (let i = 0; i < txValues.length; i += BATCH) {
  const chunk = txValues.slice(i, i + BATCH);
  const placeholders = chunk.map(() => '(?,?,?,?,?,?,?,?,?)').join(',');
  await conn.execute(
    `INSERT INTO transactions (clientId,type,category,description,amount,paymentMethod,date,studioId,createdAt) VALUES ${placeholders}`,
    chunk.flat()
  );
  process.stdout.write(`\r  Transações: ${Math.min(i+BATCH, txValues.length)}/${txValues.length}`);
}
console.log('\n  ✅ Transações inseridas');

// ── 4. DESPESAS MENSAIS ──
console.log('💸 Inserindo despesas mensais...');
const expenses = [
  ['Aluguel', 'Aluguel do espaço do estúdio', 850000, 'transferencia'],
  ['Materiais', 'Tintas, agulhas e insumos de tatuagem', 280000, 'pix'],
  ['Equipamentos', 'Manutenção de máquinas e equipamentos', 120000, 'pix'],
  ['Marketing', 'Anúncios e redes sociais', 150000, 'pix'],
  ['Limpeza', 'Produtos de higiene e esterilização', 95000, 'pix'],
  ['Energia', 'Conta de energia elétrica', 45000, 'debito'],
  ['Internet', 'Plano de internet e telefone', 18000, 'debito'],
  ['Contabilidade', 'Serviços contábeis mensais', 80000, 'transferencia'],
  ['Salários', 'Pagamento de colaboradores administrativos', 350000, 'transferencia'],
];
const expBatch = [];
for (let mo = -6; mo <= 0; mo++) {
  const d = addMonths(now, mo); d.setDate(5);
  for (const [cat, desc, amt, meth] of expenses) {
    const v = Math.floor(amt * (1 + rand(-8,8)/100));
    expBatch.push([null, 'saida', cat, desc, v, meth, fmt(d), STUDIO_ID, fmt(d)]);
  }
}
for (let i = 0; i < expBatch.length; i += BATCH) {
  const chunk = expBatch.slice(i, i + BATCH);
  const ph = chunk.map(() => '(?,?,?,?,?,?,?,?,?)').join(',');
  await conn.execute(
    `INSERT INTO transactions (clientId,type,category,description,amount,paymentMethod,date,studioId,createdAt) VALUES ${ph}`,
    chunk.flat()
  );
}
console.log(`✅ ${expBatch.length} despesas inseridas`);

// ── 5. NOTAS DE CLIENTES ──
console.log('📝 Inserindo notas de clientes...');
const notes = [
  'Cliente prefere sessões no período da tarde.',
  'Alergia a determinados tipos de tinta — verificar antes da sessão.',
  'Muito pontual e comunicativo. Ótimo cliente.',
  'Interessado em projeto de manga completa no braço direito.',
  'Referências: estilo japonês com carpa e ondas.',
  'Pele sensível — usar agulha mais fina e tinta diluída.',
  'Indicado por amigo. Primeira tatuagem.',
  'Quer cobrir cicatriz antiga no ombro.',
  'Projeto de costas completas em andamento — 3ª sessão.',
  'Cliente VIP — prioridade no agendamento.',
  'Prefere atendimento com a Juliana Costa.',
  'Tem medo de agulha — precisa de atenção especial no início.',
  'Faz parte do programa de fidelidade Ouro.',
];
const noteBatch = [];
const AUTHOR_ID = 1; // ID do usuário admin existente
for (let i = 0; i < Math.min(45, clientIds.length); i++) {
  const n = rand(1, 3);
  for (let j = 0; j < n; j++) {
    noteBatch.push([clientIds[i], AUTHOR_ID, pick(notes), fmt(addDays(now, -rand(1,180)))]);
  }
}
for (let i = 0; i < noteBatch.length; i += BATCH) {
  const chunk = noteBatch.slice(i, i + BATCH);
  const ph = chunk.map(() => '(?,?,?,?)').join(',');
  await conn.execute(`INSERT INTO clientNotes (clientId,authorId,content,createdAt) VALUES ${ph}`, chunk.flat());
}
console.log(`✅ ${noteBatch.length} notas inseridas`);

// ── 6. ATUALIZAR TOTAIS DOS CLIENTES ──
console.log('🔄 Atualizando totais dos clientes...');
await conn.execute(`
  UPDATE clients c
  SET
    totalSpent = (SELECT COALESCE(SUM(t.amount),0) FROM transactions t WHERE t.clientId = c.id AND t.type = 'entrada'),
    appointmentCount = (SELECT COUNT(*) FROM appointments a WHERE a.clientId = c.id AND a.status = 'concluido')
  WHERE c.studioId = ?
`, [STUDIO_ID]);
await conn.execute(`UPDATE clients SET loyaltyLevel='Ouro' WHERE totalSpent >= 1000000 AND studioId=?`, [STUDIO_ID]);
await conn.execute(`UPDATE clients SET loyaltyLevel='Prata' WHERE totalSpent >= 300000 AND totalSpent < 1000000 AND studioId=?`, [STUDIO_ID]);
await conn.execute(`UPDATE clients SET loyaltyLevel='Bronze' WHERE totalSpent < 300000 AND studioId=?`, [STUDIO_ID]);

// ── RESUMO ──
const [[s]] = await conn.execute(`
  SELECT
    (SELECT COUNT(*) FROM artists WHERE studioId=?) as artists,
    (SELECT COUNT(*) FROM clients WHERE studioId=?) as clients,
    (SELECT COUNT(*) FROM appointments WHERE studioId=?) as appointments,
    (SELECT COUNT(*) FROM transactions WHERE studioId=?) as transactions,
    (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='entrada' AND studioId=?) as entrada,
    (SELECT COALESCE(SUM(amount),0) FROM transactions WHERE type='saida' AND studioId=?) as saida
`, [STUDIO_ID,STUDIO_ID,STUDIO_ID,STUDIO_ID,STUDIO_ID,STUDIO_ID]);

// Receita por mês
const [monthly] = await conn.execute(`
  SELECT DATE_FORMAT(date,'%Y-%m') as mes, SUM(amount) as total
  FROM transactions WHERE type='entrada' AND studioId=?
  GROUP BY mes ORDER BY mes
`, [STUDIO_ID]);

const entrada = Number(s.entrada)/100;
const saida = Number(s.saida)/100;

console.log('\n══════════════════════════════════════════════');
console.log('  ✅ SEED CONCLUÍDO COM SUCESSO!');
console.log('══════════════════════════════════════════════');
console.log(`  🎨 Artistas:       ${s.artists}`);
console.log(`  👥 Clientes:       ${s.clients}`);
console.log(`  📅 Agendamentos:   ${s.appointments}`);
console.log(`  💳 Transações:     ${s.transactions}`);
console.log(`  💰 Receita Total:  R$ ${entrada.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
console.log(`  💸 Despesas Total: R$ ${saida.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
console.log(`  📈 Lucro Líquido:  R$ ${(entrada-saida).toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
console.log('\n  📊 Receita por Mês:');
for (const row of monthly) {
  const val = Number(row.total)/100;
  console.log(`     ${row.mes}: R$ ${val.toLocaleString('pt-BR',{minimumFractionDigits:2})}`);
}
console.log('══════════════════════════════════════════════\n');

await conn.end();
