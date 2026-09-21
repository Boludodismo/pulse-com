import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "./ui/button";
import {
  INVENTORY_COLUMNS,
  cleanCell,
  materialFields,
  receiptQuantity,
  receiptCost,
  importDate,
  importUnit,
  type ImportCells,
} from "@shared/inventorySpreadsheet";
type Row = {
  search: string;
  cells: ImportCells;
  target: string;
  action: "receive" | "catalog" | "update" | "skip";
  supplier: string;
  reviewed: boolean;
  status: string;
  done: boolean;
};
async function stableKey(text: string) {
  const b = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text)
  );
  const h = Array.from(new Uint8Array(b))
    .map(x => x.toString(16).padStart(2, "0"))
    .join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export default function InventorySpreadsheetImport({
  materials,
  artists,
  manager,
  artistId,
  onComplete,
}: {
  materials: any[];
  artists: { id: number; name: string }[];
  manager: boolean;
  artistId?: number | null;
  onComplete: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [owner, setOwner] = useState(manager ? "studio" : String(artistId || "")),
    [reference, setReference] = useState(""),
    [busy, setBusy] = useState(false),
    [started, setStarted] = useState(false),
    [filename, setFilename] = useState("");
  const lock = useRef(false);
  const suppliers = trpc.suppliers.list.useQuery({ activeOnly: true });
  const create = trpc.pod.inventory.create.useMutation(),
    receive = trpc.pod.inventory.receive.useMutation(),
    update = trpc.pod.inventory.importUpdate.useMutation();
  const owned = materials.filter(
    m => String(m.ownerArtistId ?? "studio") === owner
  );
  const patch = (i: number, p: Partial<Row>) =>
    setRows(old => old.map((r, n) => (n === i ? { ...r, ...p } : r)));
  const field = (i: number, key: string, value: string) =>
    setRows(old =>
      old.map((r, n) =>
        n === i
          ? { ...r, cells: { ...r.cells, [key]: value }, reviewed: false }
          : r
      )
    );
  async function read(file: File) {
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Arquivo acima de 5 MB.");
      const XLSX = await import("xlsx");
      const bytes = await file.arrayBuffer();
      const book = XLSX.read(bytes, {
        type: "array",
        cellDates: false,
        sheetRows: 102,
      });
      const sheet = book.Sheets.Leitura || book.Sheets[book.SheetNames[0]];
      if (
        Object.entries(sheet).some(
          ([k, v]) => !k.startsWith("!") && (v as any)?.f
        )
      )
        throw new Error(
          "Remova fórmulas da planilha; importe somente valores."
        );
      const grid = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });
      const headers = (grid.shift() || []).map(v => cleanCell(v).toLowerCase());
      if (!headers.includes("nome") || !headers.includes("unidade_base"))
        throw new Error("Use o modelo: faltam nome ou unidade_base.");
      if (
        new Set(headers.filter(Boolean)).size !== headers.filter(Boolean).length
      )
        throw new Error("Há colunas duplicadas.");
      const data = grid.filter(r => r.some(v => cleanCell(v)));
      if (
        data.length > 100 ||
        (sheet["!fullref"] &&
          XLSX.utils.decode_range(sheet["!fullref"]).e.r > 100)
      )
        throw new Error("Limite de 100 linhas por arquivo.");
      if (!data.length) throw new Error("Planilha vazia.");
      const next = data.map(values => {
        const cells = Object.fromEntries(
          INVENTORY_COLUMNS.map(k => [k, cleanCell(values[headers.indexOf(k)])])
        );
        const named = (suppliers.data || []).filter(
          s => s.name.toLowerCase() === cells.fornecedor.toLowerCase()
        );
        return {
          search: cells.nome,
          cells,
          target: "",
          action:
            cells.quantidade_recebida_base ||
            cells.quantidade_embalagens_recebidas ||
            cells.quantidade_avulsa_recebida
              ? "receive"
              : "catalog",
          supplier: named.length === 1 ? String(named[0].id) : "",
          reviewed: false,
          status: "",
          done: false,
        } as Row;
      });
      setRows(next);
      setFilename(file.name);
      setReference(
        await stableKey(Array.from(new Uint8Array(bytes)).join(","))
      );
      setStarted(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function template() {
    const XLSX = await import("xlsx");
    const b = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      b,
      XLSX.utils.aoa_to_sheet([INVENTORY_COLUMNS]),
      "Leitura"
    );
    XLSX.writeFile(b, "Tatuei_Modelo_Materiais.xlsx");
  }
  function validate(r: Row) {
    if (r.action === "skip" || r.done) return null;
    try {
      if (!owner || !reference.trim())
        throw new Error(
          "Selecione proprietário e identificação da importação."
        );
      if (!r.target)
        throw new Error("Escolha material existente ou novo cadastro.");
      const f = materialFields(r.cells);
      const m = owned.find(x => String(x.id) === r.target);
      if (r.target !== "new" && !m)
        throw new Error("Material não pertence ao proprietário selecionado.");
      if (m && importUnit(m.unit) !== f.unit)
        throw new Error("Unidade diferente do material escolhido.");
      if (r.action === "update" && !m)
        throw new Error("Atualização exige material existente.");
      if (r.action === "catalog" && r.target !== "new")
        throw new Error("Escolha atualizar cadastro ou registrar entrada.");
      if (r.action === "receive") {
        const qty = receiptQuantity(r.cells);
        receiptCost(r.cells, qty);
        if (!r.supplier) throw new Error("Selecione o fornecedor.");
        if (!r.cells.lote || r.cells.lote.length > 120)
          throw new Error("Informe o lote com até 120 caracteres.");
        importDate(r.cells.validade_data || r.cells.validade_rotulo);
      }
      if (!r.reviewed)
        throw new Error("Confira os dados e marque a revisão da linha.");
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }
  async function run() {
    if (lock.current) return;
    const errors = rows.map(validate);
    if (errors.some(Boolean)) {
      toast.error("Revise as linhas indicadas.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setStarted(true);
    try {
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.done || r.action === "skip") continue;
        patch(i, { status: "Importando…" });
        try {
          const fields = materialFields(r.cells);
          let id = Number(r.target);
          if (r.target === "new") {
            const identity = JSON.stringify(fields);
            const result = await create.mutateAsync({
              ...fields,
              ownerArtistId: owner === "studio" ? null : Number(owner),
              registrationKey: await stableKey(
                `${owner}|${reference}|material|${identity}`
              ),
              currentQuantity: "0",
              minimumQuantity: "0",
              unitCost: "0",
            });
            id = result.id!;
          }
          if (r.action === "receive") {
            const quantity = receiptQuantity(r.cells);
            await receive.mutateAsync({
              tenantMaterialId: id,
              receiptKey: await stableKey(`${owner}|${reference}|linha|${i}`),
              supplierId: Number(r.supplier),
              lot: r.cells.lote,
              expiresAt: importDate(
                r.cells.validade_data || r.cells.validade_rotulo
              ),
              quantity,
              unitCost: receiptCost(r.cells, quantity),
            });
          }
          if (r.action === "update") {
            const { unit, ...data } = fields;
            await update.mutateAsync({ tenantMaterialId: id, fields: data });
          }
          patch(i, { done: true, status: "Concluído" });
        } catch (e) {
          patch(i, { status: "Falha: " + (e as Error).message });
          toast.error(
            `Importação interrompida na linha ${i + 2}. As linhas concluídas foram mantidas. Retome com a mesma identificação.`
          );
          break;
        }
      }
    } finally {
      lock.current = false;
      setBusy(false);
      onComplete();
    }
  }
  const control = "w-full rounded border bg-background p-2 text-base min-h-11";
  const pending = rows.filter(r => !r.done && r.action !== "skip");
  return (
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer font-semibold min-h-11">
        Importar planilha de materiais
      </summary>
      <div className="space-y-4 mt-3 text-sm">
        <p>
          Importe XLSX ou CSV (até 100 linhas / 5 MB). Confira cada linha antes
          de confirmar. Novo cadastro começa com saldo zero; entrada soma a
          quantidade e preserva lote e validade. Atualização cadastral preenche
          somente campos não vazios e preserva saldo, lotes e custos. Código de
          barras, Anvisa, observações e campos de revisão são exibidos para
          conferência; não alteram o cadastro.
        </p>
        <Button variant="outline" onClick={() => void template()}>
          Baixar modelo XLSX
        </Button>
        <label className="block">
          Proprietário do estoque
          <select
            className={control}
            value={owner}
            disabled={started || busy}
            onChange={e => {
              setOwner(e.target.value);
              setRows(old =>
                old.map(r => ({ ...r, target: "", reviewed: false }))
              );
            }}
          >
            {manager && <option value="studio">Estúdio</option>}
            {artists
              .filter(a => manager || a.id === artistId)
              .map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </label>
        <label className="block">
          Selecionar planilha
          <input
            className={control}
            type="file"
            accept=".xlsx,.csv"
            disabled={busy}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) void read(f);
              e.target.value = "";
            }}
          />
        </label>
        {rows.length > 0 && (
          <>
            <p>
              {filename} · {rows.length} linhas ·{" "}
              {rows.filter(r => r.done).length} concluídas
            </p>
            <label className="block">
              Identificação única desta importação
              <input
                className={control}
                value={reference}
                disabled={started || busy}
                onChange={e => setReference(e.target.value)}
              />
            </label>
            <p>
              Mantenha a mesma identificação ao retomar ou reenviar a mesma
              planilha para evitar repetir entradas. Para uma compra diferente
              usando o mesmo arquivo, informe outra identificação. Não reordene
              linhas ao retomar.
            </p>
            {rows.map((r, i) => (
              <article key={i} className="rounded-lg border p-3 space-y-3">
                <h3 className="font-semibold">
                  Linha {i + 2}: {r.cells.nome || "Sem nome"}
                </h3>
                <fieldset
                  disabled={busy || r.done || started}
                  className="space-y-2"
                >
                  <label className="block">
                    Ação
                    <select
                      className={control}
                      value={r.action}
                      onChange={e =>
                        patch(i, {
                          action: e.target.value as Row["action"],
                          reviewed: false,
                        })
                      }
                    >
                      <option value="receive">
                        Registrar entrada por lote
                      </option>
                      <option value="catalog">
                        Cadastrar material sem saldo
                      </option>
                      <option value="update">
                        Atualizar cadastro existente
                      </option>
                      <option value="skip">Ignorar linha</option>
                    </select>
                  </label>
                  {r.action !== "skip" && (
                    <>
                      <label className="block">
                        Buscar material existente
                        <input
                          className={control}
                          value={r.search}
                          onChange={e => patch(i, { search: e.target.value })}
                          placeholder="Nome, marca ou modelo"
                        />
                      </label>
                      <label className="block">
                        Vincular ao material
                        <select
                          className={control}
                          value={r.target}
                          onChange={e =>
                            patch(i, {
                              target: e.target.value,
                              reviewed: false,
                            })
                          }
                        >
                          <option value="">
                            Selecione após comparar marca e especificações
                          </option>
                          <option value="new">Criar novo material</option>
                          {owned
                            .filter(
                              m =>
                                String(m.id) === r.target ||
                                `${m.name} ${m.brand || ""} ${m.model || ""}`
                                  .toLowerCase()
                                  .includes(r.search.toLowerCase())
                            )
                            .map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} · {m.brand} · {m.configuration} ·{" "}
                                {m.diameter} · {m.taper} · {m.unit} · #{m.id}
                              </option>
                            ))}
                        </select>
                      </label>
                      <details>
                        <summary className="cursor-pointer">
                          Conferir / corrigir os dados lidos
                        </summary>
                        <div className="grid sm:grid-cols-2 gap-2 mt-2">
                          {INVENTORY_COLUMNS.map(k => (
                            <label key={k}>
                              {k.replaceAll("_", " ")}
                              <input
                                className={control}
                                value={r.cells[k]}
                                onChange={e => field(i, k, e.target.value)}
                              />
                            </label>
                          ))}
                        </div>
                      </details>
                      <p>
                        Marca: {r.cells.marca || "não informada"} · Modelo:{" "}
                        {r.cells.modelo_sku ||
                          r.cells.configuracao ||
                          "não informado"}{" "}
                        · Unidade: {r.cells.unidade_base} · Lote:{" "}
                        {r.cells.lote || "não informado"} · Validade:{" "}
                        {r.cells.validade_data ||
                          r.cells.validade_rotulo ||
                          "não informada"}
                      </p>
                      {r.action === "receive" && (
                        <>
                          <label className="block">
                            Fornecedor da entrada
                            <select
                              className={control}
                              value={r.supplier}
                              onChange={e =>
                                patch(i, {
                                  supplier: e.target.value,
                                  reviewed: false,
                                })
                              }
                            >
                              <option value="">
                                Selecione um fornecedor cadastrado
                              </option>
                              {suppliers.data?.map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <p>
                            {(() => {
                              try {
                                const q = receiptQuantity(r.cells);
                                return `Entrada: ${Number(q)} ${r.cells.unidade_base} · Custo por unidade: R$ ${receiptCost(r.cells, q)}`;
                              } catch (e) {
                                return (e as Error).message;
                              }
                            })()}
                          </p>
                        </>
                      )}
                      {r.cells.campos_para_revisar && (
                        <p className="text-orange-400">
                          Revisar: {r.cells.campos_para_revisar}
                        </p>
                      )}
                      <label className="flex gap-2">
                        <input
                          type="checkbox"
                          checked={r.reviewed}
                          onChange={e =>
                            patch(i, { reviewed: e.target.checked })
                          }
                        />
                        Conferi produto, proprietário, unidade, quantidades,
                        lote e validade desta linha.
                      </label>
                    </>
                  )}
                </fieldset>
                {validate(r) && (
                  <p className="text-orange-400">{validate(r)}</p>
                )}
                <p role="status">{r.status}</p>
              </article>
            ))}
            <p>
              Após iniciar, os dados ficam bloqueados para permitir uma retomada
              segura. Se precisar corrigir um arquivo após falha, preserve a
              identificação e a ordem das linhas ao reabrir.
            </p>
            <Button
              disabled={
                busy || !pending.length || rows.some(r => !!validate(r))
              }
              onClick={() => void run()}
            >
              {busy
                ? "Importando…"
                : started
                  ? "Retomar importação"
                  : "Confirmar importação revisada"}
            </Button>
          </>
        )}
      </div>
    </details>
  );
}
