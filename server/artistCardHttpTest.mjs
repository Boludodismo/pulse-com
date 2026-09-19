/** One-off HTTP verification. Refuses any environment other than the isolated card test service. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const BASE='https://cartao-artista-teste-staging-custos.up.railway.app';
assert.equal(process.env.ARTIST_CARD_TEST_ENV,'true');
assert.equal(process.env.APP_BASE_URL,BASE);
assert.equal(new URL(process.env.DATABASE_URL).pathname,'/artist_card_test_20260919');
assert.equal(process.env.OUTBOUND_MESSAGING_DISABLED,'true');
assert.equal(process.env.LOCAL_ADMIN_EMAIL,'teste.cartao@example.com');
assert.equal(process.env.RAILWAY_SERVICE_ID,'e834a3ac-1180-4ba3-b0c6-e9f07a20ddd6');
const PNG='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKukAAAAASUVORK5CYII=';
const hash=b=>createHash('sha256').update(b).digest('hex');
let checks=0;
const pass=s=>{checks++;console.log('[ArtistCardHTTP] PASS '+s);};
const login=await fetch(BASE+'/api/auth/local/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.LOCAL_ADMIN_EMAIL,password:process.env.LOCAL_ADMIN_PASSWORD}),signal:AbortSignal.timeout(20000)});
assert.equal(login.status,200,'Isolated account login failed');
const cookie=login.headers.getSetCookie().map(h=>h.split(';')[0]).join('; ');assert.ok(cookie);
pass('isolated test authentication');
async function rpc(name,input={},mutation=false,auth=true){
 const payload=JSON.stringify({json:input});
 const r=await fetch(BASE+'/api/trpc/'+name+(mutation?'':'?input='+encodeURIComponent(payload)),{method:mutation?'POST':'GET',headers:{'Content-Type':'application/json',...(auth?{Cookie:cookie}:{})},...(mutation?{body:payload}:{}),signal:AbortSignal.timeout(30000)});
 const e=await r.json();if(e.error){const v=e.error.json||e.error;throw Object.assign(new Error(name+': '+v.message),{code:v.data?.code});}assert.ok(r.ok,name+' HTTP '+r.status);return e.result.data?.json??e.result.data;
}
async function denied(name,input,mutation,code,auth=true){let error;try{await rpc(name,input,mutation,auth);}catch(e){error=e;}assert.equal(error?.code,code,name+' must reject');}
const MARK='[AUTOMATED_CARD_TEST_20260919]';
async function artist(name){let rows=await rpc('artists.list');let a=rows.find(x=>x.name===name);if(a)assert.ok(a.bio?.startsWith(MARK),'Will not overwrite a manually created artist');else{await rpc('artists.create',{name,email:'',phone:'',instagram:'',specialty:'Validação isolada',bio:MARK+' Perfil fictício para verificar uploads. Não pertence a um cliente ou profissional real.',photoUrl:'',color:'#F97316',active:1},true);rows=await rpc('artists.list');a=rows.find(x=>x.name===name);}assert.ok(a?.id);return a;}
const a=await artist('Verificação técnica do cartão 2026-09-19');
const original={artistId:a.id,headline:'Cartão de teste isolado',description:'Biografia de teste. Nenhuma informação de produção.',links:[{label:'Site demonstrativo',url:'https://example.com/'}],published:false};
await rpc('studioRelations.saveCard',original,true);let card=await rpc('studioRelations.card',{artistId:a.id});const token=card.token;assert.match(token,/^[a-f0-9]{48}$/);pass('legacy save and persistent token');
await denied('studioRelations.publicCard',{token},false,'NOT_FOUND',false);pass('unpublished card unavailable');
for(const slot of ['cover','about','process']){
 await rpc('studioRelations.uploadPresentationMedia',{artistId:a.id,slot,alt:'Imagem técnica de teste '+slot,imageBase64:'data:image/png;base64,'+PNG,mimeType:'image/png',x:0,y:100},true);
 card=await rpc('studioRelations.card',{artistId:a.id});const media=card.presentation[slot];assert.ok(media.key.includes('/card/'+slot+'/'));assert.equal(media.x,0);assert.equal(media.y,100);
 const r=await fetch(new URL(media.url,BASE),{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);assert.match(r.headers.get('content-type')||'',/^image\//);assert.equal(hash(Buffer.from(await r.arrayBuffer())),hash(Buffer.from(PNG,'base64')));pass(slot+' upload persists and its original bytes can be read');
}
const texts={tagline:'Identidade e técnica',quote:'Expressão autoral',specialties:'Especialidade de teste',techniques:'Técnica informada',education:'Formação informada',experience:'Experiência informada',location:'Local de teste'};
await rpc('studioRelations.saveCard',{...original,presentation:texts},true);card=await rpc('studioRelations.card',{artistId:a.id});const saved=JSON.stringify(card.presentation);
await rpc('studioRelations.saveCard',original,true);card=await rpc('studioRelations.card',{artistId:a.id});assert.equal(JSON.stringify(card.presentation),saved);assert.equal(card.token,token);pass('old clients preserve new texts, all personal photos and link');
await denied('studioRelations.saveCard',{...original,presentation:{cover:{url:'https://example.com/not-owned.png'}}},true,'BAD_REQUEST');pass('text requests cannot inject another photo');
const oldKey=card.presentation.cover.key;
await rpc('studioRelations.uploadPresentationMedia',{artistId:a.id,slot:'cover',alt:'Capa substituída',imageBase64:PNG,mimeType:'image/png',x:50,y:50},true);
await denied('studioRelations.removePresentationMedia',{artistId:a.id,slot:'cover',expectedKey:oldKey},true,'CONFLICT');pass('stale removal does not delete a replaced photo');
card=await rpc('studioRelations.card',{artistId:a.id});await rpc('studioRelations.updateMediaFocal',{artistId:a.id,slot:'cover',expectedKey:card.presentation.cover.key,alt:'Enquadramento atualizado',x:13,y:79},true);card=await rpc('studioRelations.card',{artistId:a.id});assert.equal(card.presentation.cover.x,13);assert.equal(card.presentation.cover.y,79);pass('personal photo framing persists');
const beforeBad=card.presentation.cover.key;
await denied('studioRelations.uploadPresentationMedia',{artistId:a.id,slot:'cover',alt:'Inválida',imageBase64:'bm90IGFuIGltYWdl',mimeType:'image/png',x:50,y:50},true,'BAD_REQUEST');card=await rpc('studioRelations.card',{artistId:a.id});assert.equal(card.presentation.cover.key,beforeBad);pass('failed upload preserves previous personal photo');
for(const work of card.images)await rpc('studioRelations.removeWork',{artistId:a.id,key:work.key},true);
for(let i=0;i<3;i++)await rpc('studioRelations.uploadWork',{artistId:a.id,caption:'Verificação '+i,imageBase64:PNG,mimeType:'image/png'},true);
card=await rpc('studioRelations.card',{artistId:a.id});assert.equal(card.images.length,3);pass('portfolio uploads remain independent of personal photos');
const expectedKeys=card.images.map(w=>w.key),reversed=[...expectedKeys].reverse();
await rpc('studioRelations.reorderWorks',{artistId:a.id,keys:reversed,expectedKeys},true);card=await rpc('studioRelations.card',{artistId:a.id});assert.deepEqual(card.images.map(w=>w.key),reversed);pass('portfolio order persists');
await denied('studioRelations.reorderWorks',{artistId:a.id,keys:expectedKeys,expectedKeys},true,'CONFLICT');pass('stale portfolio reorder rejected');
await rpc('studioRelations.saveCard',{...original,published:true},true);const pub=await rpc('studioRelations.publicCard',{token},false,false);
assert.deepEqual(Object.keys(pub).sort(),['name','photo','headline','description','links','images','presentation'].sort());for(const slot of ['cover','about','process'])assert.ok(pub.presentation[slot]&&!('key' in pub.presentation[slot]));assert.ok(pub.images.every(w=>!('key' in w)));assert.equal(pub.presentation.education,texts.education);pass('public response exposes only authorized content and no storage keys');
await denied('studioRelations.card',{artistId:a.id},false,'UNAUTHORIZED',false);await denied('studioRelations.card',{artistId:2147483646},false,'FORBIDDEN');await denied('studioRelations.publicCard',{token:'invalid'},false,'BAD_REQUEST',false);pass('private editor and invalid identifiers protected');
await rpc('artists.update',{id:a.id,active:0},true);try{await denied('studioRelations.publicCard',{token},false,'NOT_FOUND',false);}finally{await rpc('artists.update',{id:a.id,active:1},true);}pass('inactive artist stays unavailable');
const b=await artist('Segundo perfil técnico do cartão 2026-09-19');await rpc('studioRelations.saveCard',{...original,artistId:b.id,headline:'Outro artista',description:'Perfil mínimo, sem imagens.',links:[],published:true},true);const other=await rpc('studioRelations.card',{artistId:b.id});assert.notEqual(other.token,token);assert.equal(other.images.length,0);assert.equal(other.presentation,null);pass('second artist has independent data and token');
card=await rpc('studioRelations.card',{artistId:a.id});assert.equal(card.token,token);assert.equal(card.images.length,3);assert.ok(card.presentation.cover&&card.presentation.about&&card.presentation.process);pass('all main data survives reload and other artist edits');
console.log('[ArtistCardHTTP] COMPLETE '+checks+' checks; test database only');
console.log('[ArtistCardHTTP] PUBLIC_CARD '+BASE+'/artista/'+token);
console.log('[ArtistCardHTTP] MINIMAL_CARD '+BASE+'/artista/'+other.token);
