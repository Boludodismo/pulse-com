import {z} from 'zod';
import {TRPCError} from '@trpc/server';
import {and, eq} from 'drizzle-orm';
import {randomBytes, randomUUID} from 'node:crypto';
import {tenantProcedure, publicProcedure} from '../_core/trpc';
import {getDb} from '../db';
import {artists} from '../../drizzle/schema';
import {artistCards} from '../../drizzle/studioRelationsSchema';
import {avatarSchema, decodeAvatar} from '../artistAvatar';
import {storagePut} from '../storage';
import {normalizeCardLinks, safePublicUrl} from '../../shared/studioRelations';
import {artistCardPresentationPatchSchema, parsePresentation, toPublicPresentation, type ArtistCardPresentationStorage} from '../../shared/artistCardPresentation';

const artistIdSchema=z.number().int().positive();
const slotSchema=z.enum(['cover','about','process']);
const linkSchema=z.object({label:z.string().trim().max(40),url:z.string().max(500)});
const focalSchema=z.object({artistId:artistIdSchema,slot:slotSchema,expectedKey:z.string().min(1).max(500),alt:z.string().trim().max(200),x:z.number().min(0).max(100),y:z.number().min(0).max(100)});
type Work={key:string;url:string;caption:string};
type AccessContext={studioId:number;artistId?:number|null;user:{role:string}};
async function database(){const db=await getDb();if(!db)throw new TRPCError({code:'INTERNAL_SERVER_ERROR',message:'Banco de dados indisponível.'});return db;}
type Database=Awaited<ReturnType<typeof database>>;
type Transaction=Parameters<Parameters<Database['transaction']>[0]>[0];
async function artistAccess(ctx:AccessContext,id:number){
  const db=await database();
  const artist=(await db.select().from(artists).where(and(eq(artists.id,id),eq(artists.studioId,ctx.studioId))).limit(1))[0];
  if(!artist||(ctx.user.role==='collaborator'&&ctx.artistId!==id))throw new TRPCError({code:'FORBIDDEN'});
  return artist;
}
function whereCard(studioId:number,artistId:number){return and(eq(artistCards.studioId,studioId),eq(artistCards.artistId,artistId));}
function readArray<T>(raw:string):T[]{try{const a:unknown=JSON.parse(raw);if(Array.isArray(a))return a as T[];}catch{}throw new TRPCError({code:'CONFLICT',message:'Não foi possível ler os dados deste cartão. Nenhum dado foi substituído.'});}
export function presentationForWrite(raw:string|null):ArtistCardPresentationStorage{
  if(!raw)return {version:1};
  const value=parsePresentation(raw);
  if(!value)throw new TRPCError({code:'CONFLICT',message:'Esta versão do cartão não pode ser editada. Recarregue ou contate o suporte.'});
  return value;
}
export function reorderCardWorks(current:Work[],keys:string[],expectedKeys:string[]):Work[]{
  if(current.length!==expectedKeys.length||current.some((image,i)=>image.key!==expectedKeys[i]))throw new TRPCError({code:'CONFLICT',message:'O portfólio mudou em outra operação. Recarregue antes de reordenar.'});
  const map=new Map(current.map(w=>[w.key,w]));
  if(keys.length!==current.length||new Set(keys).size!==keys.length||keys.some(key=>!map.has(key)))throw new TRPCError({code:'BAD_REQUEST',message:'A ordem deve conter exatamente os trabalhos atuais.'});
  return keys.map(key=>map.get(key)!);
}
export function projectPublicCard(row:{name:string;photo:string|null;headline:string;description:string;links:string;images:string;presentation:string|null}){
  return {
    name:row.name,photo:row.photo,headline:row.headline,description:row.description,
    links:readArray<{label:string;url:string}>(row.links).filter(l=>typeof l.url==='string'&&safePublicUrl(l.url)).map(l=>({label:typeof l.label==='string'?l.label:'',url:l.url})),
    images:readArray<Work>(row.images).filter(i=>typeof i.url==='string'&&!!i.url).map(i=>({url:i.url,caption:typeof i.caption==='string'?i.caption:''})),
    presentation:toPublicPresentation(parsePresentation(row.presentation)),
  };
}
async function ensureCard(tx:Transaction,studioId:number,artistId:number){
  await tx.insert(artistCards).values({studioId,artistId,token:randomBytes(24).toString('hex'),published:0,headline:'',description:'',links:'[]',images:'[]'}).onDuplicateKeyUpdate({set:{artistId}});
}
async function lockedCard(tx:Transaction,studioId:number,artistId:number){
  const row=(await tx.select().from(artistCards).where(whereCard(studioId,artistId)).for('update'))[0];
  if(!row)throw new TRPCError({code:'NOT_FOUND',message:'Cartão não encontrado.'});return row;
}
function assertMedia(p:ArtistCardPresentationStorage,slot:'cover'|'about'|'process',expectedKey:string,studioId:number,artistId:number){
  const media=p[slot];
  if(!media||media.key!==expectedKey||!media.key.startsWith(`artists/${studioId}/${artistId}/card/${slot}/`))throw new TRPCError({code:'CONFLICT',message:'A imagem foi alterada. Recarregue o cartão antes de continuar.'});
  return media;
}
function extension(mime:string){return mime==='image/jpeg'?'jpg':mime.split('/')[1];}

/** Card-only procedures. No appointment, messaging or supplier behavior is changed. */
export const artistCardEditorialProcedures={
  card:tenantProcedure.input(z.object({artistId:artistIdSchema})).query(async({ctx,input})=>{
    const artist=await artistAccess(ctx,input.artistId);const db=await database();
    const row=(await db.select().from(artistCards).where(whereCard(ctx.studioId,input.artistId)).limit(1))[0];
    if(!row)return null;
    return {...row,links:readArray<{label:string;url:string}>(row.links),images:readArray<Work>(row.images),presentation:parsePresentation(row.presentation),artistName:artist.name,artistPhoto:artist.photoUrl};
  }),
  saveCard:tenantProcedure.input(z.object({artistId:artistIdSchema,headline:z.string().max(160),description:z.string().max(3000),links:z.array(linkSchema).max(8),published:z.boolean(),presentation:artistCardPresentationPatchSchema.optional()})).mutation(async({ctx,input})=>{
    await artistAccess(ctx,input.artistId);const db=await database();let links:{label:string;url:string}[];
    try{links=normalizeCardLinks(input.links);}catch(error){throw new TRPCError({code:'BAD_REQUEST',message:(error as Error).message});}
    await db.transaction(async tx=>{
      await ensureCard(tx,ctx.studioId,input.artistId);
      const row=await lockedCard(tx,ctx.studioId,input.artistId);
      const data:Partial<typeof artistCards.$inferInsert>={headline:input.headline,description:input.description,links:JSON.stringify(links),published:input.published?1:0};
      if(input.presentation!==undefined){
        const p=presentationForWrite(row.presentation);
        for(const key of ['quote','tagline','specialties','techniques','education','experience','location'] as const){if(input.presentation[key]!==undefined)p[key]=input.presentation[key];}
        data.presentation=JSON.stringify(p);
      }
      await tx.update(artistCards).set(data).where(whereCard(ctx.studioId,input.artistId));
    });return {ok:true};
  }),
  uploadWork:tenantProcedure.input(avatarSchema.extend({artistId:artistIdSchema,caption:z.string().max(160)})).mutation(async({ctx,input})=>{
    await artistAccess(ctx,input.artistId);const buffer=decodeAvatar(input);const db=await database();
    const key=`artists/${ctx.studioId}/${input.artistId}/portfolio/${randomUUID()}.${extension(input.mimeType)}`;
    await db.transaction(async tx=>{
      await ensureCard(tx,ctx.studioId,input.artistId);const row=await lockedCard(tx,ctx.studioId,input.artistId);const images=readArray<Work>(row.images);
      if(images.length>=12)throw new TRPCError({code:'BAD_REQUEST',message:'Limite de 12 trabalhos por cartão.'});
      const uploaded=await storagePut(key,buffer,input.mimeType);
      if(!uploaded.url)throw new TRPCError({code:'PRECONDITION_FAILED',message:'O armazenamento de imagens está indisponível. A imagem não foi incluída.'});
      images.push({key,url:uploaded.url,caption:input.caption});
      await tx.update(artistCards).set({images:JSON.stringify(images)}).where(whereCard(ctx.studioId,input.artistId));
    });return {ok:true};
  }),
  removeWork:tenantProcedure.input(z.object({artistId:artistIdSchema,key:z.string()})).mutation(async({ctx,input})=>{
    await artistAccess(ctx,input.artistId);const db=await database();
    await db.transaction(async tx=>{const row=await lockedCard(tx,ctx.studioId,input.artistId);const images=readArray<Work>(row.images);await tx.update(artistCards).set({images:JSON.stringify(images.filter(w=>w.key!==input.key))}).where(whereCard(ctx.studioId,input.artistId));});return {ok:true};
  }),
  reorderWorks:tenantProcedure.input(z.object({artistId:artistIdSchema,keys:z.array(z.string().max(500)).max(12),expectedKeys:z.array(z.string().max(500)).max(12)})).mutation(async({ctx,input})=>{
    await artistAccess(ctx,input.artistId);const db=await database();
    await db.transaction(async tx=>{const row=await lockedCard(tx,ctx.studioId,input.artistId);const ordered=reorderCardWorks(readArray<Work>(row.images),input.keys,input.expectedKeys);await tx.update(artistCards).set({images:JSON.stringify(ordered)}).where(whereCard(ctx.studioId,input.artistId));});return {ok:true};
  }),
  uploadPresentationMedia:tenantProcedure.input(avatarSchema.extend({artistId:artistIdSchema,slot:slotSchema,alt:z.string().trim().max(200),x:z.number().min(0).max(100),y:z.number().min(0).max(100)})).mutation(async({ctx,input})=>{
    await artistAccess(ctx,input.artistId);const buffer=decodeAvatar(input);const db=await database();const key=`artists/${ctx.studioId}/${input.artistId}/card/${input.slot}/${randomUUID()}.${extension(input.mimeType)}`;
    await db.transaction(async tx=>{
      await ensureCard(tx,ctx.studioId,input.artistId);const row=await lockedCard(tx,ctx.studioId,input.artistId);const p=presentationForWrite(row.presentation);
      const uploaded=await storagePut(key,buffer,input.mimeType);if(!uploaded.url)throw new TRPCError({code:'PRECONDITION_FAILED',message:'O armazenamento de imagens está indisponível. A foto anterior foi preservada.'});
      p[input.slot]={key,url:uploaded.url,alt:input.alt,x:input.x,y:input.y};await tx.update(artistCards).set({presentation:JSON.stringify(p)}).where(whereCard(ctx.studioId,input.artistId));
    });return {ok:true};
  }),
  updateMediaFocal:tenantProcedure.input(focalSchema).mutation(async({ctx,input})=>{
    await artistAccess(ctx,input.artistId);const db=await database();
    await db.transaction(async tx=>{const row=await lockedCard(tx,ctx.studioId,input.artistId);const p=presentationForWrite(row.presentation);const media=assertMedia(p,input.slot,input.expectedKey,ctx.studioId,input.artistId);p[input.slot]={...media,alt:input.alt,x:input.x,y:input.y};await tx.update(artistCards).set({presentation:JSON.stringify(p)}).where(whereCard(ctx.studioId,input.artistId));});return {ok:true};
  }),
  removePresentationMedia:tenantProcedure.input(z.object({artistId:artistIdSchema,slot:slotSchema,expectedKey:z.string().min(1).max(500)})).mutation(async({ctx,input})=>{
    await artistAccess(ctx,input.artistId);const db=await database();
    await db.transaction(async tx=>{const row=await lockedCard(tx,ctx.studioId,input.artistId);const p=presentationForWrite(row.presentation);assertMedia(p,input.slot,input.expectedKey,ctx.studioId,input.artistId);p[input.slot]=null;await tx.update(artistCards).set({presentation:JSON.stringify(p)}).where(whereCard(ctx.studioId,input.artistId));});return {ok:true};
  }),
  publicCard:publicProcedure.input(z.object({token:z.string().regex(/^[a-f0-9]{48}$/)})).query(async({input})=>{
    const db=await database();const row=(await db.select({name:artists.name,photo:artists.photoUrl,headline:artistCards.headline,description:artistCards.description,links:artistCards.links,images:artistCards.images,presentation:artistCards.presentation}).from(artistCards).innerJoin(artists,and(eq(artists.id,artistCards.artistId),eq(artists.studioId,artistCards.studioId),eq(artists.active,1))).where(and(eq(artistCards.token,input.token),eq(artistCards.published,1))).limit(1))[0];
    if(!row)throw new TRPCError({code:'NOT_FOUND',message:'Cartão não publicado.'});
    return projectPublicCard(row);
  }),
};
