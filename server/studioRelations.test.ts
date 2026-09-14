import {describe,it,expect,vi,beforeEach} from 'vitest';
import {renderQuote,safePublicUrl,QUOTE_MODELS,normalizeCardLinks} from '../shared/studioRelations';
const mocks=vi.hoisted(()=>({getDb:vi.fn(),storagePut:vi.fn()}));
vi.mock('./db',()=>({getDb:mocks.getDb}));vi.mock('./storage',()=>({storagePut:mocks.storagePut}));vi.mock('./saas',()=>({isUserAccessActive:vi.fn(async()=>true)}));
import {studioRelationsRouter} from './routers/studioRelations';
const ctx={user:{id:1,studioId:10,role:'admin'},studioId:10} as any;
function database(reads:any[][]){const writes:any[]=[];const db:any={select:()=>{const rows=reads.shift()||[];const chain:any={from:()=>chain,where:()=>chain,limit:()=>chain,innerJoin:()=>chain,orderBy:()=>chain,for:()=>chain,then:(r:any)=>Promise.resolve(rows).then(r)};return chain;},update:()=>({set:(values:any)=>({where:async()=>writes.push(values)})}),insert:()=>({values:(v:any)=>({onDuplicateKeyUpdate:async()=>writes.push(v),then:(r:any)=>{writes.push(v);return Promise.resolve([{insertId:7}]).then(r);}})}),transaction:async(f:any)=>f(db)};mocks.getDb.mockResolvedValue(db);return writes;}
beforeEach(()=>vi.clearAllMocks());
describe('Cartões e reposição',()=>{
 it('não permite links executáveis ou credenciais na URL pública',()=>{expect(safePublicUrl('javascript:alert(1)')).toBe(false);expect(safePublicUrl('https://user:pass@example.com')).toBe(false);expect(safePublicUrl('https://instagram.com/artista')).toBe(true);});
 it('preenche variáveis próprias sem esconder campos que faltam',()=>{expect(QUOTE_MODELS).toHaveLength(2);expect(renderQuote('Olá {nome}! Entrega {prazo}. {prazo}',{nome:'Ana'})).toEqual({message:'Olá Ana! Entrega {prazo}. {prazo}',missing:['prazo']});});
 it('impede um artista de editar o cartão de outro',async()=>{const writes=database([[{id:6,studioId:10}]]);await expect(studioRelationsRouter.createCaller({...ctx,user:{...ctx.user,role:'collaborator',artistId:5},artistId:5}).saveCard({artistId:6,headline:'Teste',description:'',links:[],published:true})).rejects.toMatchObject({code:'FORBIDDEN'});expect(writes).toEqual([]);});
 it('impede editar cartão fora do estúdio',async()=>{const writes=database([[]]);await expect(studioRelationsRouter.createCaller(ctx).saveCard({artistId:99,headline:'Teste',description:'',links:[],published:true})).rejects.toMatchObject({code:'FORBIDDEN'});expect(writes).toEqual([]);});
 it('não aprova rascunho cujo texto mudou após a revisão',async()=>{const writes=database([[{id:4,status:'draft',message:'Texto novo',recipientPhone:'5531999999999'}]]);await expect(studioRelationsRouter.createCaller(ctx).approve({id:4,message:'Texto antigo',phone:'5531999999999'})).rejects.toMatchObject({code:'CONFLICT'});expect(writes).toEqual([]);});
 it('mantém o rascunho sem envio quando não há integração',async()=>{const writes=database([[{id:4,status:'draft',message:'Orçamento revisado',recipientPhone:'5531999999999'}],[]]);await expect(studioRelationsRouter.createCaller(ctx).approve({id:4,message:'Orçamento revisado',phone:'5531999999999'})).rejects.toMatchObject({code:'BAD_REQUEST'});expect(writes).toEqual([]);});
 it('exige vínculo de fornecimento para avisar o artista',async()=>{const writes=database([[{id:2,studioId:10}],[]]);await expect(studioRelationsRouter.createCaller(ctx).notification({materialId:2,artistId:8,enabled:false})).rejects.toMatchObject({code:'BAD_REQUEST'});expect(writes).toEqual([]);});
 it('não cria orçamento com fornecedor não autorizado',async()=>{const writes=database([[{id:2,studioId:10}],[]]);await expect(studioRelationsRouter.createCaller(ctx).draft({materialId:2,supplierId:9,quantity:2,body:'Olá, gostaria de um orçamento.',variables:{}})).rejects.toMatchObject({code:'BAD_REQUEST'});expect(writes).toEqual([]);});
 it('aceita nome vazio com link, ignora linha vazia e explica link incompleto',()=>{
 expect(normalizeCardLinks([{label:'',url:'https://www.instagram.com/artista'},{label:' ',url:' '}])).toEqual([{label:'Instagram',url:'https://www.instagram.com/artista'}]);
 expect(()=>normalizeCardLinks([{label:'Instagram',url:''}])).toThrow('Informe o link');
 expect(()=>normalizeCardLinks([{label:'',url:'https://www.'}])).toThrow('endereço completo');
 });
 it('salva cartão com o nome da rede inferido do endereço',async()=>{
 const writes=database([[{id:6,studioId:10}]]);
 await studioRelationsRouter.createCaller(ctx).saveCard({artistId:6,headline:'Teste',description:'',links:[{label:'',url:'https://www.instagram.com/artista'}],published:false});
 expect(JSON.parse(writes[0].links)).toEqual([{label:'Instagram',url:'https://www.instagram.com/artista'}]);
 });
 it('permite primeiro upload criando apenas rascunho, sem publicar nem alterar textos existentes',async()=>{
 const writes=database([[{id:6,studioId:10}],[{id:9,images:'[]'}],[{id:9,images:'[]'}]]);
 mocks.storagePut.mockResolvedValue({url:'/api/storage?teste'});
 await studioRelationsRouter.createCaller(ctx).uploadWork({artistId:6,caption:'Teste',mimeType:'image/png',imageBase64:Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')});
 expect(writes[0]).toMatchObject({artistId:6,published:0,images:'[]'});
 expect(JSON.parse(writes[1].images)[0]).toMatchObject({caption:'Teste',url:'/api/storage?teste'});
 expect(Object.keys(writes[1])).toEqual(['images']);
 });

});
