import { TECHNICAL_CATALOG_2026, type TechnicalCatalogSeedItem } from './technicalCatalog2026';
const base = TECHNICAL_CATALOG_2026.find(x => x.sku === 'BATOQUE-P')!;
const caps = ([['P',500],['M',300],['G',200]] as const).map(([size,quantity]):TechnicalCatalogSeedItem => ({
  ...base,brandName:'Electric Ink',lineName:'Ink Cap Silicone',name:`Batoque Electric Ink ${size}`,sku:`EI-INKCAP-${size}`,
  format:size,packageQuantity:quantity,packageUnit:`Embalagem com ${quantity} unidades`,unitsPerPackage:quantity,
  sourceUrl:'https://www.electricink.com.br/inkcap-batoquesdesiliconerosa/p',evidenceStatus:'fabricante',
  notes:'Saldo fictício de uma embalagem grande. Cor não especificada pelo artista. Baixa por unidade.',
}));
const blacks = ['EI-PRETO-LINHA','EI-PRETO-TRIBAL','EASY-RAVEN','EASY-RAVEN-FL','EASY-ULTRALINER'].map(sku => {
  const item=TECHNICAL_CATALOG_2026.find(x=>x.sku===sku)!;
  return {...item,name:`${item.name} — 240 ml`,sku:`${sku}-240`,volumeMl:240,unitsPerPackage:240,packageUnit:'Frasco de 240 ml'};
});
export const SESSION_TEST_SUPPLIES:TechnicalCatalogSeedItem[] = [
 ...caps,
 {...base,brandName:'Electric Ink',lineName:'Tattoo Vaseline Slip Premium',name:'Vaselina Electric Ink Slip Premium — 800 g',sku:'EI-SLIP-PREMIUM-800',category:'Cosméticos e cuidados',format:null,packageQuantity:1,packageUnit:'Pote de 800 g',baseUnit:'g',purchaseUnit:'pote',unitsPerPackage:800,sourceUrl:'https://www.electricink.com.br/tattoo-vaseline-slip-premium/p',notes:'Saldo fictício. Consumo sugerido pelo artista: 20 g por sessão; ajustável.'},
 ...blacks,
 {...blacks[2],name:'Ultra Tribal Black EG (Dark Vader) — 240 ml',sku:'EASY-DARK-VADER-240',colorName:'Ultra Tribal Black',sourceUrl:'https://www.electricink.com.br/ultra-tribal-black-eg-dark-vader/p'},
];
