import {INVENTORY_COLUMNS,cleanCell,type ImportCells} from './inventorySpreadsheet';
export async function readInventoryWorkbook(bytes:ArrayBuffer):Promise<ImportCells[]>{
 const XLSX=await import('xlsx');
 const book=XLSX.read(bytes,{type:'array',codepage:65001,raw:true,cellDates:false,cellNF:true,sheetRows:102});
 const sheet=book.Sheets.Leitura||book.Sheets[book.SheetNames[0]];
 if(!sheet||!sheet['!ref'])throw new Error('Planilha vazia.');
 const range=XLSX.utils.decode_range(sheet['!ref']);
 if(Object.entries(sheet).some(([k,v])=>!k.startsWith('!')&&(v as any)?.f))throw new Error('Remova fórmulas da planilha; importe somente valores.');
 const grid=XLSX.utils.sheet_to_json<any[]>(sheet,{header:1,defval:'',raw:false});
 const headers=(grid.shift()||[]).map(v=>cleanCell(v).toLowerCase());
 if(!headers.includes('nome')||!headers.includes('unidade_base'))throw new Error('Use o modelo: faltam nome ou unidade_base.');
 if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw new Error('Há colunas duplicadas.');
 if(grid.length>100||sheet['!fullref']&&XLSX.utils.decode_range(sheet['!fullref']).e.r-range.s.r>100)throw new Error('Limite de 100 linhas por arquivo.');
 const rows=grid.map((values,i)=>Object.fromEntries(INVENTORY_COLUMNS.map(k=>{
 const index=headers.indexOf(k);let value=values[index];
 if(index>=0&&['validade_data','validade_rotulo'].includes(k)){
 const cell=sheet[XLSX.utils.encode_cell({r:range.s.r+i+1,c:range.s.c+index})];
 if(cell?.t==='n'&&cell.z&&XLSX.SSF.is_date(cell.z)){
 const d=XLSX.SSF.parse_date_code(Number(cell.v),{date1904:!!book.Workbook?.WBProps?.date1904});
 if(!d)throw new Error('Data de validade inválida.');value=`${String(d.y).padStart(4,'0')}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
 }
 }
 return [k,cleanCell(value)];
 }))).filter(r=>Object.values(r).some(Boolean));
 if(!rows.length)throw new Error('Planilha vazia.');return rows;
}
