# Implementação de Campos Financeiros no Agendamento

## Resumo das Alterações

Adicionados campos financeiros ao módulo de agendamento: `depositPaid`, `depositAmount` e `totalAmount`. Alterações mínimas e objetivas em 4 arquivos.

---

## 1. SCHEMA DO BANCO DE DADOS

**Arquivo:** `drizzle/schema.ts`

### Alterações:
- Adicionado import: `import { decimal } from "drizzle-orm/mysql-core"`
- Adicionados 3 campos na tabela `appointments`:
  ```typescript
  depositPaid: tinyint().default(0).notNull(),           // Sinal pago (0=não, 1=sim)
  depositAmount: decimal({ precision: 10, scale: 2 }).default(0).notNull(),  // Valor do sinal
  totalAmount: decimal({ precision: 10, scale: 2 }).default(0).notNull(),    // Valor total
  ```

### Banco de Dados:
- Colunas adicionadas via SQL direto (pnpm db:push teve conflito com migrations)
- Comando executado:
  ```sql
  ALTER TABLE appointments ADD COLUMN depositPaid TINYINT DEFAULT 0 NOT NULL, 
  ADD COLUMN depositAmount DECIMAL(10,2) DEFAULT 0 NOT NULL, 
  ADD COLUMN totalAmount DECIMAL(10,2) DEFAULT 0 NOT NULL;
  ```

---

## 2. BACKEND - ROUTERS

**Arquivo:** `server/routers.ts`

### Alterações no `appointments.create`:
- Adicionados campos no input zod:
  ```typescript
  depositPaid: z.boolean().optional(),
  depositAmount: z.number().min(0).optional(),
  totalAmount: z.number().min(0).optional(),
  ```
- Adicionados no `appointmentData`:
  ```typescript
  depositPaid: input.depositPaid ? 1 : 0,
  depositAmount: input.depositAmount || 0,
  totalAmount: input.totalAmount || 0,
  ```

### Alterações no `appointments.update`:
- Adicionados campos no input zod (mesmos do create)
- Adicionados no `updateData`:
  ```typescript
  depositPaid,
  depositAmount: depositAmount ? parseFloat(depositAmount) : 0,
  totalAmount: totalAmount ? parseFloat(totalAmount) : 0,
  ```

---

## 3. FRONTEND - EVENT MODAL

**Arquivo:** `client/src/components/EventModal.tsx`

### Alterações:
1. **Estados adicionados:**
   ```typescript
   const [depositPaid, setDepositPaid] = useState<boolean>(false);
   const [depositAmount, setDepositAmount] = useState<string>("");
   const [totalAmount, setTotalAmount] = useState<string>("");
   ```

2. **Preenchimento ao editar:**
   ```typescript
   setDepositPaid(existingEvent.depositPaid ? true : false);
   setDepositAmount(existingEvent.depositAmount?.toString() || "");
   setTotalAmount(existingEvent.totalAmount?.toString() || "");
   ```

3. **Reset do formulário:**
   ```typescript
   setDepositPaid(false);
   setDepositAmount("");
   setTotalAmount("");
   ```

4. **Dados ao criar/atualizar:**
   ```typescript
   depositPaid,
   depositAmount: depositAmount ? parseFloat(depositAmount) : 0,
   totalAmount: totalAmount ? parseFloat(totalAmount) : 0,
   ```

5. **UI - Seção de campos financeiros** (antes do upload de imagem):
   - Checkbox "Sinal Pago"
   - Input "Valor do Sinal (R$)"
   - Input "Valor Total (R$)"
   - Cálculo derivado: "Restante: R$ X.XX"

---

## 4. FUNCIONALIDADES

✅ **Criar agendamento** com campos financeiros  
✅ **Editar agendamento** preservando valores financeiros  
✅ **Cálculo automático** do valor restante (total - sinal)  
✅ **Persistência** no banco de dados  
✅ **Refetch automático** após salvar  

---

## 5. COMO TESTAR

1. Abra o calendário visual
2. Clique para criar novo agendamento
3. Preencha os dados básicos (cliente, data, hora, serviço, artista)
4. Na seção "Campos Financeiros":
   - Marque "Sinal Pago" (opcional)
   - Insira "Valor do Sinal" (ex: 100.00)
   - Insira "Valor Total" (ex: 500.00)
   - Veja o cálculo: "Restante: R$ 400.00"
5. Clique "Salvar"
6. Edite o agendamento para confirmar que os valores foram salvos
7. Verifique no banco: `SELECT depositPaid, depositAmount, totalAmount FROM appointments WHERE id = X;`

---

## 6. NOTAS TÉCNICAS

- Campos são **opcionais** no frontend (podem ser deixados em branco)
- Valores padrão no banco: `0` (zero)
- Tipo: `DECIMAL(10,2)` para precisão monetária
- Cálculo do "restante" é **derivado** (não persistido)
- Sem lógica complexa adicional (conforme solicitado)

---

## 7. ARQUIVOS ALTERADOS

1. `drizzle/schema.ts` - Schema + import decimal
2. `server/routers.ts` - Endpoints create/update
3. `client/src/components/EventModal.tsx` - UI + estados + lógica
4. Banco de dados - Colunas adicionadas via SQL

**Total de linhas modificadas:** ~80 linhas  
**Complexidade:** Baixa (mudanças pontuais e diretas)
