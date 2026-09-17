import { TECHNICAL_CATALOG_2026, canAddCatalogItemToOperationalStock, type TechnicalCatalogSeedItem } from './technicalCatalog2026';

export const TEST_CATALOG_VERSION = 'market-test-2026-09-17';
export const TEST_STOCK_REASON = 'SALDO FICTÍCIO PARA TESTES — ajustar após contagem real';
export type PriceReference = { label: string; url: string; price: number; quantity: number; unit: string };
const medina = 'https://medinatattoosupplies.com.br/';
export const PRICE_REFERENCES: Record<string, PriceReference> = {
 electricCaps:{label:'Ink Cap Electric Ink P 500 (comparável por unidade para P/M/G)',url:'https://www.electricink.com.br/inkcap-batoquesdesiliconerosa/p',price:61.50,quantity:500,unit:'un'},
 vaseline:{label:'Vaselina Electric Ink Slip Premium 800 g',url:'https://www.blackhousetattooshop.com.br/',price:85,quantity:800,unit:'g'},
 sulfite:{label:'Chamex A4 500 folhas',url:'https://www.kalunga.com.br/prod/papel-sulfite-a4-75g-210mmx297mm-chamex-pt-500-fl/476102',price:34.50,quantity:500,unit:'folha'},
 bleach:{label:'Cloro Rio 1% 5 L Rioquímica (similar)',url:'https://magazinemedica.com.br/produtos/desinfetante-hipoclorito-de-sodio-1-cloro-rio-rioquimica_5l/',price:48.14,quantity:5000,unit:'ml'},
 stencil:{label:'Transfer GT Stencil 150 ml (similar)',url:medina+'categoria/transfer/',price:45,quantity:150,unit:'ml'},
 printer:{label:'Impressora OZER Thermal Portátil (similar)',url:medina+'categoria/transfer/',price:1885.50,quantity:1,unit:'un'},
 bandage:{label:'Bandagem autoaderente 5 cm × 4,57 m (similar)',url:medina+'categoria/higiene-e-descarte/bandagens/',price:9,quantity:4.57,unit:'m'},
 mixer:{label:'Ink Spin agitador elétrico (similar)',url:medina+'categoria/acessorios/',price:288,quantity:1,unit:'un'},
 mixerRefill:{label:'Refil Ink Mixer 10 unidades (similar)',url:medina+'categoria/acessorios/',price:6.29,quantity:10,unit:'un'},
 alcohol:{label:'Álcool Clarity 70% 1 L',url:'https://www.dnac.com.br/',price:7.11,quantity:1000,unit:'ml'},
 mask:{label:'Máscara Medix, caixa 50',url:'https://medinatattoosupplies.com.br/',price:12.51,quantity:50,unit:'un'},
 gauze:{label:'Gaze Cremer Iris, 500',url:'https://www.drogariavenancio.com.br/',price:77.39,quantity:500,unit:'un'},
 sharps:{label:'Coletor Descarpack 7 L',url:'https://www.medicaltop.com.br/descarpack-coletor-para-material-perfurocortante-descartavel-7l',price:18.49,quantity:1,unit:'un'},
 couch:{label:'Papel lençol Flexpell, 10 rolos de 50 m',url:'https://www.promedical.com.br/papel-lencol-50x50-extra-flexpell-cx-10-unidade',price:169.90,quantity:500,unit:'m'},
 covers:{label:'Protetor clipcord Electric Ink 100',url:'https://www.electricink.com.br/protetorparaclipcord-100un-/p',price:75.10,quantity:100,unit:'un'},
 trash:{label:'Sacos de lixo 100 L, 100',url:'https://www.sindicoshop.com.br/',price:49.90,quantity:100,unit:'un'},
 pipette:{label:'Pipeta Pasteur 3 ml, 500',url:'https://www.quimicenter.com.br/',price:64.90,quantity:500,unit:'un'},
 skin: {label:'Skin Ink RL/Fine Line, caixa 20',url:'https://www.dracotattooshop.com.br/cartucho-unitario-skin',price:189,quantity:20,unit:'un'},
 big: {label:'Skin Ink BIG, caixa 10',url:'https://www.dracotattooshop.com.br/cartucho-skin-ink-big-mg-reta-magnum-reta-caixa-com-10-unidades',price:189,quantity:10,unit:'un'},
 peak: {label:'Peak Triton, caixa 20',url:medina+'produto/cartucho-peak-triton-caixa-20/',price:197.10,quantity:20,unit:'un'},
 emalla: {label:'Emalla RL, caixa 20 (oferta consultada)',url:'https://www.tcmsupply.com.br/',price:208.79,quantity:20,unit:'un'},
 ez: {label:'EZ Revo RS, caixa 20 (oferta consultada)',url:'https://www.area51tattoosupplyes.com.br/',price:200,quantity:20,unit:'un'},
 dragon: {label:'Dragonhawk Yue, caixa 20 (comparável)',url:'https://www.marcodelapielbrasil.com.br/',price:200,quantity:20,unit:'un'},
 kwadron: {label:'Kwadron RL 0,30, caixa 20 (oferta consultada)',url:'https://www.otatuador.com.br/',price:299.90,quantity:20,unit:'un'},
 cheyenne: {label:'Cheyenne Safety 17 Magnum 0,35 (comparável)',url:'https://www.tattooloja.com.br/',price:20,quantity:1,unit:'un'},
 capillary: {label:'Cheyenne Capillary Liner 0,30, a partir de',url:'https://www.tattooloja.com.br/',price:22.21,quantity:1,unit:'un'},
 craft: {label:'Cheyenne Craft avulso (comparável)',url:'https://www.jordantattoosupply.com/',price:8,quantity:1,unit:'un'},
 ink: {label:'Electric Ink Rosa 30 ml (comparável de cor)',url:'https://www.dracotattooshop.com.br/8j3o6sr2s-/tinta-marrom-escuro-electric-ink',price:89.90,quantity:30,unit:'ml'},
 ink15: {label:'Easy Glow 15 ml, a partir de',url:medina,price:49.41,quantity:15,unit:'ml'},
 ink240: {label:'Easy Glow Raven Black 240 ml (comparável)',url:'https://www.dracotattooshop.com.br/',price:272.50,quantity:240,unit:'ml'},
 gloves: {label:'Luva Unigloves nitrílica, 100 unidades = 50 pares (similar à Descarpack)',url:medina+'categoria/higiene-e-descarte/descartaveis/',price:39.90,quantity:50,unit:'par'},
 cups: {label:'Batoque P, pacote 100',url:'https://www.tatuart.com.br/batoques-e-porta-batoques',price:10,quantity:100,unit:'un'},
 sheets: {label:'Lençol MEDIX, pacote 10 (preço parcelado total)',url:medina+'categoria/higiene-e-descarte/descartaveis/',price:24.90,quantity:10,unit:'un'},
 barrier: {label:'Barreira adesiva 10 × 15 cm, 1200',url:medina+'categoria/higiene-e-descarte/assepsia/',price:58.50,quantity:1200,unit:'un'},
 razor: {label:'Barbeador Hammerworks, 30 (preço parcelado total)',url:medina+'categoria/higiene-e-descarte/descartaveis/',price:52.90,quantity:30,unit:'un'},
 paper: {label:'Thermal Flux A4 GT, 100 folhas (comparável)',url:medina+'categoria/transfer/',price:197.10,quantity:100,unit:'folha'},
 paperPremium: {label:'Thermal EZ, 50 folhas (comparável)',url:medina+'categoria/transfer/',price:215.10,quantity:50,unit:'folha'},
 film: {label:'OnSkin curativo, 15 cm × 10 m (comparável)',url:medina+'categoria/transfer/',price:71.91,quantity:10,unit:'m'},
 tropical: {label:'TropicalDerm FIX PRO 5 cm × 5 m (comparável)',url:'https://www.dracotattooshop.com.br/',price:99,quantity:5,unit:'m'},
 wipe: {label:'Tropical Wipes, pacote 50',url:medina+'categoria/higiene-e-descarte/assepsia/',price:44.91,quantity:50,unit:'un'},
 soap: {label:'Witch Razel concentrado, 500 ml (comparável de limpeza tattoo)',url:medina+'categoria/higiene-e-descarte/assepsia/',price:62.91,quantity:500,unit:'ml'},
 balm: {label:'Aftercare Hornet, 15 g (comparável)',url:medina+'categoria/vaselina-e-pomadas/',price:8.91,quantity:15,unit:'g'},
 cream: {label:'Aftercare MBoah, 25 ml (comparável)',url:medina+'categoria/vaselina-e-pomadas/',price:20.61,quantity:25,unit:'ml'},
 spray: {label:'Spray Ice Calm ArtPig 120 ml (comparável)',url:medina+'categoria/vaselina-e-pomadas/',price:20.61,quantity:120,unit:'ml'},
 cable: {label:'Cabo RCA New Fontes (comparável)',url:medina+'categoria/pedal/',price:31.50,quantity:1,unit:'un'},
 pedal: {label:'Pedal Chapa Slim (comparável)',url:medina+'categoria/pedal/',price:197.10,quantity:1,unit:'un'},
 wireless: {label:'FK Irons Killswitch, preço parcelado total (comparável)',url:medina+'categoria/pedal/',price:1605.50,quantity:1,unit:'un'},
 battery: {label:'Fonte sem fio Power 1, total parcelado (comparável)',url:medina+'categoria/fontes/',price:799,quantity:1,unit:'un'},
 cell: {label:'Bateria NCR 18500, total parcelado (comparável)',url:medina+'categoria/fontes/',price:100,quantity:1,unit:'un'},
 power: {label:'Fonte Eikon EMS420, total parcelado (comparável)',url:medina+'categoria/fontes/',price:1999,quantity:1,unit:'un'},
 machine: {label:'Pen Pro ArtPig sem fio (comparável)',url:medina+'categoria/equipamentos/maquinas/',price:1079.10,quantity:1,unit:'un'},
 hawk: {label:'Cheyenne Hawk Pen II 3.5',url:'https://www.celebrim.com.br/',price:7100,quantity:1,unit:'un'},
 sol: {label:'Cheyenne SOL Nova Unlimited II 3.5',url:'https://www.celebrim.com.br/',price:8100,quantity:1,unit:'un'},
};

// Only compare the same product family. Missing evidence is not a zero-price quote.
export function estimatePrice(item: TechnicalCatalogSeedItem) {
 let ref: string | undefined, factor = 1;
 const n = item.name.toLocaleLowerCase(), cat = item.category, brand = item.brandName;
 if (item.sku?.startsWith('EI-INKCAP-')) ref='electricCaps';
 else if (item.sku==='EI-SLIP-PREMIUM-800') ref='vaseline';
 else if (cat === 'Cartuchos e agulhas') {
   ref = ({'Skin Ink':/big/i.test(item.lineName)?'big':'skin',Peak:'peak',EMALLA:'emalla',EZ:'ez',Dragonhawk:'dragon',Kwadron:'kwadron',Cheyenne:/capillary/i.test(item.lineName)?'capillary':/craft/i.test(item.lineName)?'craft':'cheyenne','Electric Ink':'skin'} as Record<string,string>)[brand];
 } else if(cat === 'Tintas e pigmentos') {
   ref = (item.volumeMl ?? 30) <= 15 ? 'ink15' : (item.volumeMl ?? 30) >= 120 ? 'ink240' : 'ink';
 } else if(/luva/i.test(n)) ref = 'gloves';
 else if(cat === 'Máquinas e alimentação') {
   if(/cabo rca|clip cord/.test(n)) ref='cable';
   else if(/pedal|foot switch/.test(n)) ref=/sem fio|connect/.test(n)?'wireless':'pedal';
   else if(/bateria recarregável/.test(n)) ref='cell';
   else if(brand==='Genérico'&&/bateria universal/.test(n)) ref='battery';
   else if(brand==='Genérico'&&/fonte digital/.test(n)) ref='power';
   else if(brand==='Cheyenne'&&/hawk pen/.test(n)) ref='hawk';
   else if(brand==='Cheyenne'&&/sol nova unlimited/.test(n)) ref='sol';
 } else if(/wipes/.test(n)) ref='wipe';
 else if(/spray|sealing/.test(n)) ref='spray';
 else if(/filme fix|filme pro|dermalize/.test(n)) {
   ref=brand==='TropicalDerm'?'tropical':'film';
   if(item.baseUnit==='folha') {ref='film';factor=0.1;}
 } else if(/filme protetor adesivo|curativo transparente/.test(n)) {ref='film';if(item.baseUnit==='un')factor=0.1;}
 else if(/balm/.test(n)) ref='balm';
 else if(/creme|manteiga|hustle butter/.test(n)&&item.baseUnit==='ml') ref='cream';
 else if(/papel.*(thermal|térmico|hectográfico|transfer)|spirit|stencil paper/.test(n)&&item.baseUnit==='folha') ref=brand==='Genérico'?'paper':'paperPremium';
 else if(/stencil|transfer formula|gel transfer/.test(n)&&['ml','frasco'].includes(item.baseUnit)) {
   ref='stencil'; if(item.baseUnit==='frasco')factor=n.includes('8 oz')?240:120;
 } else if(/álcool/.test(n)) ref='alcohol';
 else if(/hipoclorito/.test(n)) ref='bleach';
 else if(/sulfite/.test(n)) ref='sulfite';
 else if(/green soap|prep cleanser|sabonete pós/.test(n)) ref='soap';
 else if(/batoque/.test(n)&&!/suporte|reutilizável/.test(n)) ref='cups';
 else if(/barbeador|lâmina/.test(n)) ref='razor';
 else if(/barreira adesiva/.test(n)){ref='barrier';if(item.baseUnit==='rolo')factor=1200;}
 else if(/lençol/.test(n)) ref='sheets';
 else if(/papel para maca/.test(n)) ref='couch';
 else if(/bandagem|fita grip/.test(n)){ref='bandage';if(item.baseUnit==='rolo')factor=4.5;}
 else if(/coletor/.test(n)&&/7 l/.test(n)) ref='sharps';
 else if(/impressora/.test(n)) ref='printer';
 else if(/mixer.*elétrico/.test(n)) ref='mixer';
 else if(/bastão para mixer/.test(n)) ref='mixerRefill';
 else if(/máscara/.test(n)) ref='mask';
 else if(/gaze não estéril/.test(n)) ref='gauze';
 else if(/saco de lixo/.test(n)) ref='trash';
 else if(/protetor de|capa para|saco para fonte/.test(n)) ref='covers';
 else if(/pipeta/.test(n)) ref='pipette';
 const source=ref?PRICE_REFERENCES[ref]:undefined;
 return {estimated:!!source,status:source?'estimated':'pending',confidence:source?'estimativa por família/similar':'sem cotação comparável confirmada',date:'2026-09-17',currency:'BRL',reference:source,factor,
   unitCost:source?((source.price/source.quantity)*factor).toFixed(4):'0.0000',
   method:source?'Estimativa por família/similar; não é cotação individual do SKU. Sem frete. Conversão pela unidade-base; tamanhos e marcas podem variar. Revisar com a nota de compra.':'Preço pendente: não foi confirmada uma oferta comparável. O campo zerado não significa material gratuito. Preencha o custo antes de usar relatórios financeiros.',
 };
}
export function testStock(item: TechnicalCatalogSeedItem) {
 const durable=item.category==='Máquinas e alimentação'||/impressora|mixer.*elétrico|suporte|squeeze|borrifador|escova/.test(item.name.toLowerCase());
 const quantity=durable?2:item.category==='Cartuchos e agulhas'?20:item.baseUnit==='ml'?Math.max(item.unitsPerPackage,30):Math.max(item.unitsPerPackage,10);
 const minimum=durable?1:Math.max(0.25, Math.round(quantity*0.25*1000)/1000);
 return {quantity:quantity.toFixed(3),minimum:minimum.toFixed(3)};
}
export function readTestMetadata(notes: string|null|undefined): any {
 try { const value=JSON.parse(notes??'{}'); return value && typeof value==='object'&&!Array.isArray(value)?value:{}; } catch {return {};}
}
export function catalogIdentity(item: {brandName:string;lineName:string;name:string;sku:string|null}) {
 return JSON.stringify([item.brandName,item.lineName,item.sku??item.name].map(v=>v.trim().toLowerCase()));
}
export const TEST_IMPORTABLE_COUNT=TECHNICAL_CATALOG_2026.filter(canAddCatalogItemToOperationalStock).length;
