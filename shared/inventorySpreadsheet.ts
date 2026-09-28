export const INVENTORY_COLUMNS = [
  "nome",
  "categoria",
  "marca",
  "linha",
  "modelo_sku",
  "configuracao",
  "quantidade_pontas",
  "calibre_fabricante",
  "diametro_mm",
  "taper",
  "tamanho_batoque",
  "codigo_barras",
  "anvisa_rotulo",
  "unidade_base",
  "tipo_embalagem",
  "itens_por_embalagem",
  "volume_por_embalagem_ml",
  "peso_por_embalagem_g",
  "quantidade_embalagens_recebidas",
  "quantidade_avulsa_recebida",
  "quantidade_recebida_base",
  "lote",
  "validade_rotulo",
  "validade_data",
  "fornecedor",
  "proprietario_estoque",
  "custo_total_da_entrada",
  "custo_por_unidade_base",
  "campos_para_revisar",
  "observacoes",
];
export type ImportCells = Record<string, string>;
export function cleanCell(v: unknown) {
  return v == null || String(v).trim().toLowerCase() === "null"
    ? ""
    : String(v).trim();
}
export function importNumber(v: string, places = 3) {
  if (!/^\d+(?:[.,]\d+)?$/.test(v))
    throw new Error(
      "Número inválido: " + v + ". Use decimal sem separador de milhar."
    );
  const n = Number(v.replace(",", "."));
  if (
    !Number.isFinite(n) ||
    n > 999999999 ||
    v.replace(",", ".").split(".")[1]?.length > places
  )
    throw new Error(
      "Número fora do limite ou com casas decimais em excesso: " + v
    );
  return n;
}
export function importDate(v: string) {
  if (!v) return undefined;
  let iso = v;
  const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) iso = `${br[3]}-${br[2]}-${br[1]}`;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(iso) ||
    new Date(iso + "T00:00:00Z").toISOString().slice(0, 10) !== iso
  )
    throw new Error("Validade incompleta ou inválida: " + v);
  return iso;
}
export function importUnit(v: string) {
  const u = v.toLowerCase();
  return ["un", "unidade", "unidades"].includes(u) ? "un" : u;
}
export function receiptQuantity(r: ImportCells) {
  const u = importUnit(r.unidade_base);
  let calculated: number | undefined;
  if (r.quantidade_embalagens_recebidas) {
    const packs = importNumber(r.quantidade_embalagens_recebidas);
    if (!Number.isInteger(packs))
      throw new Error("Quantidade de embalagens deve ser inteira.");
    const content =
      u === "ml"
        ? r.volume_por_embalagem_ml
        : u === "g"
          ? r.peso_por_embalagem_g
          : r.itens_por_embalagem;
    if (!content) throw new Error("Informe o conteúdo de cada embalagem.");
    calculated = packs * importNumber(content);
  }
  if (r.quantidade_avulsa_recebida)
    calculated = (calculated ?? 0) + importNumber(r.quantidade_avulsa_recebida);
  const qty = r.quantidade_recebida_base
    ? importNumber(r.quantidade_recebida_base)
    : calculated;
  if (qty == null || qty <= 0 || qty > 999999999)
    throw new Error("Informe a quantidade recebida.");
  if (calculated != null && Math.abs(calculated - qty) > 0.000001)
    throw new Error("Quantidade recebida diverge das embalagens e avulsos.");
  if (["un", "par"].includes(u) && !Number.isInteger(qty))
    throw new Error("Unidades e pares devem ser inteiros.");
  return qty.toFixed(3);
}
export function receiptCost(r: ImportCells, qty: string) {
  const cost = r.custo_por_unidade_base
    ? importNumber(r.custo_por_unidade_base, 4)
    : r.custo_total_da_entrada
      ? importNumber(r.custo_total_da_entrada, 4) / Number(qty)
      : undefined;
  if (cost == null)
    throw new Error(
      "Informe o custo da entrada ou por unidade (zero se gratuito)."
    );
  if (
    r.custo_total_da_entrada &&
    r.custo_por_unidade_base &&
    Math.abs(cost * Number(qty) - importNumber(r.custo_total_da_entrada, 4)) >
      0.01
  )
    throw new Error("Custo total diverge do custo unitário.");
  if (cost > 99999999.9999) throw new Error("Custo unitário acima do limite.");
  return cost.toFixed(4);
}
export function materialFields(r: ImportCells) {
  if (r.nome.length > 255) throw new Error("Nome acima de 255 caracteres.");
  if (r.nome.length < 2) throw new Error("Informe o nome.");
  const unit = importUnit(r.unidade_base);
  if (!["un", "ml", "g", "par", "m", "rolo"].includes(unit))
    throw new Error("Unidade deve ser un, ml, g, par, m ou rolo.");
  const out: any = { name: r.nome, unit };
  const mapping: Record<string, string> = {
    categoria: "category",
    marca: "brand",
    linha: "line",
    modelo_sku: "model",
    configuracao: "configuration",
    calibre_fabricante: "gauge",
    diametro_mm: "diameter",
    taper: "taper",
    tipo_embalagem: "purchaseUnit",
  };
  for (const [key, target] of Object.entries(mapping))
    if (r[key]) {
      const max =
        target === "diameter"
          ? 40
          : target === "gauge"
            ? 20
            : target === "taper"
              ? 80
              : target === "purchaseUnit"
                ? 50
                : 120;
      if (r[key].length > max)
        throw new Error(key + " excede " + max + " caracteres.");
      out[target] = r[key];
    }
  if (!out.configuration && r.tamanho_batoque)
    out.configuration = r.tamanho_batoque;
  for (const [key, target] of [
    ["quantidade_pontas", "needleCount"],
    ["itens_por_embalagem", "packageQuantity"],
  ])
    if (r[key]) {
      const n = importNumber(r[key]);
      if (
        !Number.isInteger(n) ||
        n < 1 ||
        n > (target === "needleCount" ? 1000 : 100000)
      )
        throw new Error(
          "Quantidade por embalagem e pontas devem ser inteiras e positivas."
        );
      out[target] = n;
    }
  return out;
}
