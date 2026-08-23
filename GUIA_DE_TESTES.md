# 🎨 Guia de Testes - Sistema de Gestão para Estúdios de Tatuagem

**Versão:** 1.0  
**Data:** 13 de Janeiro de 2026  
**Autor:** Manus AI

---

## 📋 Sobre Este Documento

Este guia foi criado para ajudar colaboradores a testarem o sistema de gestão para estúdios de tatuagem durante o período de validação. O sistema está em **fase de testes** e seu feedback é essencial para identificarmos melhorias e correções necessárias.

---

## 🔗 Acesso ao Sistema

**Link de Desenvolvimento (Temporário):**  
**https://8080-ik7c4gsszl81cs3n1uwlo-11ac7344.us2.manus.computer**

### Como Acessar

O sistema utiliza autenticação OAuth da Manus. Ao acessar o link acima:

1. Clique em **"Sign in"**
2. Você será redirecionado para a página de login da Manus
3. Faça login com sua conta Manus (ou crie uma nova)
4. Após autenticação, você será redirecionado automaticamente para o dashboard

> **Nota:** Se você não tiver uma conta Manus, pode criar gratuitamente durante o processo de login.

---

## 👥 Níveis de Acesso (Hierarquia)

O sistema possui **3 níveis hierárquicos** de usuários:

### 1. **SUPERADMIN** (Administrador Global)
- **Acesso:** TODOS os dados de TODOS os estúdios
- **Permissões:** Gerenciar múltiplos estúdios, criar admins, acesso total
- **Uso:** Proprietário da plataforma ou gestor geral

### 2. **ADMIN** (Administrador do Estúdio)
- **Acesso:** Todos os dados do SEU estúdio apenas
- **Permissões:** Gerenciar clientes, agendamentos, colaboradores, relatórios, configurações
- **Uso:** Dono ou gerente de um estúdio específico

### 3. **COLLABORATOR** (Colaborador/Artista)
- **Acesso:** Apenas SEUS clientes e agendamentos
- **Permissões:** Ver e gerenciar apenas clientes vinculados ao seu perfil de artista
- **Uso:** Tatuadores e colaboradores do estúdio

> **Isolamento de Dados:** Cada estúdio vê apenas seus próprios dados. Colaboradores veem apenas seus próprios clientes.

---

## 🎯 Funcionalidades Principais

### 📊 **1. Dashboard**
- Visão geral do estúdio
- Métricas principais:
  - Total de clientes cadastrados
  - Agendamentos ativos
  - Receita total
  - Aniversariantes do mês
- Top 5 clientes (por valor gasto)
- Lista de aniversariantes próximos

**O que testar:**
- ✅ As métricas estão corretas?
- ✅ Os números batem com a realidade?
- ✅ Os aniversariantes estão aparecendo corretamente?

---

### 👥 **2. Clientes**
Gestão completa de clientes do estúdio.

**Funcionalidades:**
- Cadastro de novos clientes
- Edição de informações
- Exclusão de clientes
- Busca e filtros
- Visualização de histórico
- Sistema de fidelidade (Bronze, Prata, Ouro, Platina, Diamante)

**Campos disponíveis:**
- Nome, email, telefone
- Data de nascimento
- Endereço completo
- Observações
- Artista responsável (opcional)

**O que testar:**
- ✅ Consegue cadastrar novos clientes?
- ✅ A busca funciona corretamente?
- ✅ Os badges de fidelidade aparecem?
- ✅ Consegue editar e excluir clientes?

---

### 📅 **3. Agenda**
Gerenciamento de agendamentos em formato de lista.

**Funcionalidades:**
- Criar novos agendamentos
- Editar agendamentos existentes
- Excluir agendamentos
- Filtrar por status (agendado, confirmado, concluído, cancelado)
- Filtrar por artista
- Busca por cliente

**Informações do agendamento:**
- Cliente
- Data e hora
- Duração
- Serviço
- Artista responsável
- Status
- Observações

**O que testar:**
- ✅ Consegue criar agendamentos?
- ✅ Os filtros funcionam?
- ✅ Consegue alterar status?
- ✅ A exclusão funciona?

---

### 📆 **4. Calendário Visual**
Visualização de agendamentos em formato de calendário mensal.

**Funcionalidades:**
- Visualização mensal
- Navegação entre meses
- Clique no dia para ver agendamentos
- Modal com detalhes do agendamento
- Indicadores visuais de status

**O que testar:**
- ✅ Os agendamentos aparecem nos dias corretos?
- ✅ As cores dos status estão claras?
- ✅ O modal de detalhes abre corretamente?
- ✅ Consegue navegar entre meses?

---

### 📈 **5. Relatórios**
*(Disponível apenas para ADMIN e SUPERADMIN)*

Análises e relatórios do estúdio.

**Tipos de relatórios:**
- Relatório financeiro
- Relatório de agendamentos
- Relatório de clientes
- Gráficos de performance

**O que testar:**
- ✅ Os dados estão corretos?
- ✅ Os gráficos carregam?
- ✅ Os filtros de período funcionam?

---

### 🔔 **6. Notificações**
Sistema de notificações do estúdio.

**O que testar:**
- ✅ As notificações aparecem?
- ✅ Consegue marcar como lida?
- ✅ O contador de não lidas funciona?

---

### ⚠️ **7. Alertas de Risco**
Alertas baseados em fichas de anamnese.

**Níveis de risco:**
- 🟢 Baixo
- 🟡 Médio
- 🟠 Alto
- 🔴 Crítico

**O que testar:**
- ✅ Os alertas aparecem corretamente?
- ✅ As cores dos níveis estão claras?
- ✅ Consegue visualizar detalhes?

---

### 👤 **8. Usuários**
*(Disponível apenas para ADMIN e SUPERADMIN)*

Gerenciamento de usuários do sistema.

**Funcionalidades:**
- Criar novos usuários
- Editar permissões (role)
- Ativar/desativar usuários
- Vincular colaborador a artista

**Roles disponíveis:**
- Superadmin
- Admin
- Collaborator

**O que testar:**
- ✅ Consegue criar usuários?
- ✅ Consegue alterar roles?
- ✅ O vínculo com artista funciona?

---

### 📝 **9. Auditoria**
*(Disponível apenas para ADMIN e SUPERADMIN)*

Registro de todas as ações no sistema.

**Informações registradas:**
- Usuário que executou a ação
- Tipo de ação (criar, editar, excluir)
- Entidade afetada
- Data e hora
- Detalhes da ação

**O que testar:**
- ✅ As ações estão sendo registradas?
- ✅ Os filtros funcionam?
- ✅ As informações estão completas?

---

### ⚙️ **10. Configurações**
*(Disponível apenas para ADMIN e SUPERADMIN)*

Configurações do estúdio.

**O que configurar:**
- Informações do estúdio
- Preferências do sistema
- Integrações

**O que testar:**
- ✅ Consegue alterar configurações?
- ✅ As mudanças são salvas?

---

## 🧪 Cenários de Teste Sugeridos

### **Cenário 1: Fluxo Completo de Agendamento**

1. Acesse **Clientes** e cadastre um novo cliente
2. Vá para **Agenda** e crie um agendamento para esse cliente
3. Verifique se o agendamento aparece no **Calendário Visual**
4. Altere o status do agendamento para "Confirmado"
5. Verifique se a mudança refletiu em todas as telas

**Resultado esperado:** Todas as informações devem estar sincronizadas.

---

### **Cenário 2: Teste de Permissões**

1. Faça login como **ADMIN**
2. Verifique que você vê apenas dados do seu estúdio
3. Tente acessar **Usuários** e **Relatórios** (deve funcionar)
4. Peça para alguém fazer login como **COLLABORATOR**
5. Verifique que o colaborador vê apenas seus clientes

**Resultado esperado:** Cada usuário deve ver apenas o que tem permissão.

---

### **Cenário 3: Busca e Filtros**

1. Acesse **Clientes**
2. Use a busca para encontrar um cliente específico
3. Teste os filtros (por artista, por status, etc.)
4. Faça o mesmo em **Agenda**

**Resultado esperado:** Busca e filtros devem funcionar corretamente.

---

### **Cenário 4: Edição e Exclusão**

1. Edite um cliente existente
2. Edite um agendamento existente
3. Exclua um agendamento de teste
4. Verifique se as mudanças foram salvas

**Resultado esperado:** Todas as operações devem funcionar sem erros.

---

## 🐛 Como Reportar Problemas

Se você encontrar algum problema, bug ou tiver sugestões, por favor reporte com as seguintes informações:

### **Template de Reporte:**

```
📌 TIPO: [Bug / Sugestão / Dúvida]

📄 DESCRIÇÃO:
[Descreva o problema ou sugestão]

📍 ONDE ACONTECEU:
[Página/funcionalidade específica]

🔄 COMO REPRODUZIR:
1. [Passo 1]
2. [Passo 2]
3. [Passo 3]

✅ RESULTADO ESPERADO:
[O que deveria acontecer]

❌ RESULTADO OBTIDO:
[O que realmente aconteceu]

📸 PRINT/VÍDEO:
[Se possível, anexe print ou vídeo]
```

---

## ⚠️ Observações Importantes

### **Dados de Teste**

O sistema já possui alguns dados de teste criados:

- **7 clientes** cadastrados
- **5 agendamentos** de exemplo
- **2 estúdios** (Estúdio 1 e Estúdio B)
- **Usuários de teste** com diferentes roles

**Você pode:**
- ✅ Criar novos dados livremente
- ✅ Editar dados existentes
- ✅ Excluir dados de teste
- ⚠️ **NÃO** exclua dados importantes de outros testadores

---

### **Limitações Conhecidas**

Durante o período de testes, algumas funcionalidades podem estar em desenvolvimento:

- Sistema de cadastro de novos estúdios (em desenvolvimento)
- Página de registro público (em desenvolvimento)
- Algumas páginas podem ter placeholders

---

### **Duração dos Testes**

- **Período:** ~3 semanas
- **Link:** Temporário (pode hibernar se ficar sem uso)
- **Dados:** Salvos no banco de dados (não serão perdidos)

Se o link parar de funcionar, entre em contato para reativação.

---

## 📞 Suporte

Se tiver dúvidas ou precisar de ajuda:

1. Revise este guia primeiro
2. Teste as funcionalidades descritas
3. Reporte problemas usando o template acima
4. Entre em contato com o administrador do sistema

---

## ✅ Checklist de Testes

Use este checklist para guiar seus testes:

### **Funcionalidades Básicas**
- [ ] Consegui fazer login
- [ ] Dashboard carrega corretamente
- [ ] Menu lateral funciona
- [ ] Navegação entre páginas funciona

### **Gestão de Clientes**
- [ ] Cadastrar novo cliente
- [ ] Editar cliente existente
- [ ] Buscar clientes
- [ ] Visualizar detalhes do cliente
- [ ] Excluir cliente

### **Gestão de Agendamentos**
- [ ] Criar novo agendamento
- [ ] Editar agendamento
- [ ] Alterar status
- [ ] Filtrar agendamentos
- [ ] Excluir agendamento
- [ ] Visualizar no calendário

### **Permissões**
- [ ] Vejo apenas meus dados (se colaborador)
- [ ] Vejo dados do meu estúdio (se admin)
- [ ] Não vejo dados de outros estúdios

### **Interface**
- [ ] Design está claro e intuitivo
- [ ] Botões funcionam corretamente
- [ ] Formulários são fáceis de usar
- [ ] Mensagens de erro são claras

### **Performance**
- [ ] Páginas carregam rapidamente
- [ ] Não há travamentos
- [ ] Busca é rápida

---

## 🎯 Objetivo dos Testes

O objetivo principal é validar:

1. **Funcionalidade:** Tudo funciona como esperado?
2. **Usabilidade:** É fácil de usar?
3. **Permissões:** O isolamento de dados funciona?
4. **Performance:** O sistema é rápido?
5. **Bugs:** Existem erros ou problemas?

Seu feedback é essencial para entregarmos um sistema de qualidade! 🚀

---

**Bons testes!** 🎨✨
