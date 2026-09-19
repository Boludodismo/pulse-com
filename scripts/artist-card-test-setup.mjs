/** Explicit one-off validation for the newly created, isolated test service.
 * No public endpoint, no production data, no embedded credentials.
 * Invoked only by the test service's temporary pre-deploy command.
 */
import assert from 'node:assert/strict';
import {brotliDecompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const BASE='https://cartao-artista-teste-staging-custos.up.railway.app';
assert.equal(process.env.ARTIST_CARD_TEST_ENV,'true','Test flag required');
assert.equal(process.env.APP_BASE_URL,BASE,'Only the isolated test domain is allowed');
assert.equal(new URL(process.env.DATABASE_URL).pathname,'/artist_card_test_20260919','Only the dedicated test database is allowed');
assert.equal(process.env.OUTBOUND_MESSAGING_DISABLED,'true','Messages must remain disabled');
assert.equal(process.env.LOCAL_ADMIN_EMAIL,'teste.cartao@example.com','Only the dedicated test account is allowed');
if(process.env.RAILWAY_SERVICE_ID)assert.equal(process.env.RAILWAY_SERVICE_ID,'e834a3ac-1180-4ba3-b0c6-e9f07a20ddd6');
let cookie='';let checks=0;
const log=(label)=>{checks++;console.log(`[ArtistCardTest] PASS ${label}`);};
const login=await fetch(BASE+'/api/auth/local/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.LOCAL_ADMIN_EMAIL,password:process.env.LOCAL_ADMIN_PASSWORD}),signal:AbortSignal.timeout(20000)});
assert.equal(login.status,200,'Test account login failed');
cookie=login.headers.getSetCookie().map(h=>h.split(';')[0]).join('; ');assert.ok(cookie,'No test session cookie');
log('test account authentication');
async function rpc(name,input={},mutation=false,authenticated=true){
  const payload=JSON.stringify({json:input});
  const response=await fetch(BASE+'/api/trpc/'+name+(mutation?'':'?input='+encodeURIComponent(payload)),{method:mutation?'POST':'GET',headers:{'Content-Type':'application/json',...(authenticated?{Cookie:cookie}:{})},...(mutation?{body:payload}:{}),signal:AbortSignal.timeout(30000)});
  const envelope=await response.json();
  if(envelope.error){const error=envelope.error.json||envelope.error;throw Object.assign(new Error(`${name}: ${error.message||'request failed'}`),{code:error.data?.code,status:response.status});}
  assert.ok(response.ok,`${name} returned HTTP ${response.status}`);
  return envelope.result.data?.json??envelope.result.data;
}
async function rejected(name,input,mutation,code,authenticated=true){
  let actual;try{await rpc(name,input,mutation,authenticated);}catch(error){actual=error.code;}
  assert.equal(actual,code,`${name} must reject with ${code}`);
}
async function ensureArtist(name){
  let rows=await rpc('artists.list');let artist=rows.find(a=>a.name===name);
  if(!artist){await rpc('artists.create',{name,email:'',phone:'',instagram:'',specialty:'Modelo demonstrativo',bio:'Perfil fictício exclusivo para validar a apresentação.',photoUrl:'',color:'#F97316',active:1},true);rows=await rpc('artists.list');artist=rows.find(a=>a.name===name);}
  assert.ok(artist?.id,'Test artist could not be created');return artist;
}
const artist=await ensureArtist('Artista Demonstração');
let card=await rpc('studioRelations.card',{artistId:artist.id});
// A previously completed setup must never overwrite subsequent human edits.
if(card?.published===1&&card.images.length>=5&&card.presentation?.cover&&card.presentation?.about&&card.presentation?.process){
  console.log('[ArtistCardTest] Existing completed demo preserved.');
  console.log('[ArtistCardTest] PUBLIC_CARD '+BASE+'/artista/'+card.token);
  process.exit(0);
}
const source='https://raw.githubusercontent.com/Boludodismo/pulse-com/refs/heads/preview/artist-card-editorial-2026-09-19/previews/artist-card-online/';
const pieces=[];
for(const n of [1,2,3]){const r=await fetch(source+`page.${n}.brpart`,{signal:AbortSignal.timeout(20000)});assert.ok(r.ok,'Approved demo asset unavailable');pieces.push(Buffer.from(await r.arrayBuffer()));}
const html=brotliDecompressSync(Buffer.concat(pieces));
assert.equal(createHash('sha256').update(html).digest('hex'),'f1c733770f8de84e224762bc93c9b8a1fd8ac0577cd4dd8cc775cee3ce72ce8d','Approved demo checksum mismatch');
const text=html.toString('utf8'),start=text.indexOf('const DEMO_DATA=')+'const DEMO_DATA='.length,end=text.indexOf(';</script>',start);
assert.ok(start>15&&end>start,'Demo data block missing');
const demo=JSON.parse(text.slice(start,end)); // Data only: never execute the demo HTML/JavaScript.
log('approved fictional reference images verified');
const original={artistId:artist.id,headline:'Artista visual / cartão demonstrativo',description:'Este é um perfil fictício criado exclusivamente para testar o novo cartão de apresentação. As imagens são demonstrativas e não representam trabalhos ou a identidade de um profissional cadastrado.\n\nCada artista poderá substituir a biografia, as fotografias e as informações profissionais pelos próprios conteúdos. O sistema preserva a organização visual padronizada.',links:[{label:'Instagram',url:'https://www.instagram.com/'},{label:'Portfólio de exemplo',url:'https://example.com/'}],published:false};
await rpc('studioRelations.saveCard',original,true);
card=await rpc('studioRelations.card',{artistId:artist.id});const token=card.token;
assert.match(token,/^[a-f0-9]{48}$/);log('legacy card payload and individual token');
await rejected('studioRelations.publicCard',{token},false,'NOT_FOUND',false);log('unpublished card remains private');
for(const slot of ['cover','about','process']){
  if(!card.presentation?.[slot]){const media=demo.presentation[slot];assert.ok(media.url.startsWith('data:image/jpeg;base64,'));await rpc('studioRelations.uploadPresentationMedia',{artistId:artist.id,slot,alt:'Imagem demonstrativa — '+slot,imageBase64:media.url,mimeType:'image/jpeg',x:media.x??50,y:media.y??50},true);}
}
card=await rpc('studioRelations.card',{artistId:artist.id});
for(let i=card.images.length;i<5;i++)await rpc('studioRelations.uploadWork',{artistId:artist.id,caption:`Imagem demonstrativa ${i+1}`,imageBase64:demo.images[i].url,mimeType:'image/jpeg'},true);
log('three presentation photos and five portfolio uploads');
const presentation={tagline:'Sua identidade.\nSua técnica. Sua expressão.',quote:'Uma visão autoral.\nUma presença marcante.',specialties:'Espaço para as especialidades informadas pelo artista.',techniques:'Espaço para técnicas e linguagens de trabalho.',education:'Espaço para formação, cursos e aperfeiçoamentos. Nenhuma credencial foi atribuída a um profissional real.',experience:'Espaço para a experiência descrita pelo próprio artista.',location:'Cidade e local de atuação a informar.'};
await rpc('studioRelations.saveCard',{...original,presentation},true);
card=await rpc('studioRelations.card',{artistId:artist.id});const beforeLegacy=JSON.stringify(card.presentation);
await rpc('studioRelations.saveCard',original,true);
card=await rpc('studioRelations.card',{artistId:artist.id});assert.equal(JSON.stringify(card.presentation),beforeLegacy);assert.equal(card.token,token);assert.equal(card.images.length,5);log('old-client save preserves new fields, photos and token');
await rpc('studioRelations.updateMediaFocal',{artistId:artist.id,slot:'cover',expectedKey:card.presentation.cover.key,alt:'Retrato fictício demonstrativo',x:0,y:100},true);
card=await rpc('studioRelations.card',{artistId:artist.id});assert.equal(card.presentation.cover.x,0);assert.equal(card.presentation.cover.y,100);log('focal coordinates zero and one hundred persist');
await rpc('studioRelations.updateMediaFocal',{artistId:artist.id,slot:'cover',expectedKey:card.presentation.cover.key,alt:'Retrato fictício demonstrativo',x:demo.presentation.cover.x??50,y:demo.presentation.cover.y??50},true);
await rejected('studioRelations.removePresentationMedia',{artistId:artist.id,slot:'cover',expectedKey:'artists/other/card/cover/stale.jpg'},true,'CONFLICT');log('stale media removal rejected');
await rejected('studioRelations.saveCard',{...original,presentation:{cover:{url:'https://example.com/injected.jpg'}}},true,'BAD_REQUEST');log('media injection through text patch rejected');
const expectedKeys=card.images.map(w=>w.key),reverse=[...expectedKeys].reverse();
await rpc('studioRelations.reorderWorks',{artistId:artist.id,keys:reverse,expectedKeys},true);
card=await rpc('studioRelations.card',{artistId:artist.id});assert.deepEqual(card.images.map(w=>w.key),reverse);log('portfolio order persists');
await rejected('studioRelations.reorderWorks',{artistId:artist.id,keys:expectedKeys,expectedKeys},true,'CONFLICT');log('stale concurrent portfolio ordering rejected');
await rpc('studioRelations.reorderWorks',{artistId:artist.id,keys:expectedKeys,expectedKeys:reverse},true);
await rejected('studioRelations.card',{artistId:artist.id},false,'UNAUTHORIZED',false);log('editor requires an authenticated session');
await rejected('studioRelations.card',{artistId:2147483646},false,'FORBIDDEN');log('unknown artist access rejected');
await rpc('studioRelations.saveCard',{...original,published:true},true);
let published=await rpc('studioRelations.publicCard',{token},false,false);
assert.deepEqual(Object.keys(published).sort(),['description','headline','images','links','name','photo','presentation'].sort());assert.equal(published.images.length,5);assert.ok(published.presentation.cover);assert.ok(!('key' in published.presentation.cover));assert.ok(!('key' in published.images[0]));log('public API exposes only the selected public fields');
const mediaResponse=await fetch(published.presentation.cover.url,{signal:AbortSignal.timeout(20000)});assert.equal(mediaResponse.status,200);assert.match(mediaResponse.headers.get('content-type')||'',/^image\//);log('uploaded photo is publicly readable through its authorized URL');
await rpc('artists.update',{id:artist.id,active:0},true);
try{await rejected('studioRelations.publicCard',{token},false,'NOT_FOUND',false);log('inactive artist card is unavailable');}finally{await rpc('artists.update',{id:artist.id,active:1},true);}
await rejected('studioRelations.publicCard',{token:'invalid'},false,'BAD_REQUEST',false);log('invalid public token rejected');
published=await rpc('studioRelations.publicCard',{token},false,false);assert.equal(published.name,artist.name);log('public card remains available after validation');
const minimal=await ensureArtist('Perfil sem fotos — Teste');const existingMinimal=await rpc('studioRelations.card',{artistId:minimal.id});
if(!existingMinimal)await rpc('studioRelations.saveCard',{artistId:minimal.id,headline:'Perfil demonstrativo sem imagens',description:'Este exemplo permite verificar o layout quando o profissional ainda não adicionou fotografias, formação ou redes sociais.',links:[],published:true},true);
const minimalCard=await rpc('studioRelations.card',{artistId:minimal.id});assert.notEqual(minimalCard.token,token);log('second artist has an independent token');
console.log(`[ArtistCardTest] COMPLETE ${checks} real HTTP/API checks`);
console.log('[ArtistCardTest] PUBLIC_CARD '+BASE+'/artista/'+token);
console.log('[ArtistCardTest] MINIMAL_CARD '+BASE+'/artista/'+minimalCard.token);
