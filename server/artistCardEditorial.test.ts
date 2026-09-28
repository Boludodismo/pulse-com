import {describe,it,expect} from 'vitest';
import {artistCardPresentationPatchSchema,parsePresentation,toPublicPresentation} from '../shared/artistCardPresentation';
import {presentationForWrite,projectPublicCard,reorderCardWorks} from './routers/artistCardEditorial';
import {normalizeCardLinks} from '../shared/studioRelations';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import ArtistEditorialCard from '../client/src/components/artist-card/ArtistEditorialCard';

const stored={version:1 as const,tagline:'Arte autoral',cover:{key:'artists/1/2/card/cover/file.jpg',url:'https://example.com/image.jpg',alt:'Retrato',x:0,y:100}};
const work=(key:string)=>({key,url:`https://example.com/${key}.jpg`,caption:`Obra ${key}`});
const publicRow={name:'Artista Exemplo',photo:null,headline:'Artista visual',description:'Biografia de teste.',links:JSON.stringify([{label:'Instagram',url:'https://instagram.com/exemplo',internal:'hidden'}]),images:JSON.stringify([work('one')]),presentation:JSON.stringify(stored)};

describe('artist card presentation contracts',()=>{
  it('keeps legacy absence empty',()=>expect(parsePresentation(null)).toBeNull());
  it('does not default omitted patch fields',()=>expect(artistCardPresentationPatchSchema.parse({})).toEqual({}));
  it('allows an explicit empty string to remove optional text',()=>expect(artistCardPresentationPatchSchema.parse({quote:'   '})).toEqual({quote:''}));
  it('rejects a media URL injection through saveCard text patch',()=>expect(artistCardPresentationPatchSchema.safeParse({cover:{url:'https://example.com/other-artist.jpg'}}).success).toBe(false));
  it('rejects excessive text instead of silently truncating',()=>expect(artistCardPresentationPatchSchema.safeParse({tagline:'a'.repeat(181)}).success).toBe(false));
  it('keeps zero and one hundred focal coordinates',()=>expect(parsePresentation(JSON.stringify(stored))?.cover).toMatchObject({x:0,y:100}));
  it('handles invalid JSON safely on read',()=>expect(parsePresentation('{oops')).toBeNull());
  it('handles unsupported versions safely on read',()=>expect(parsePresentation('{"version":2}')).toBeNull());
  it('rejects invalid stored data on write without replacing it',()=>expect(()=>presentationForWrite('{"version":2}')).toThrow());
  it('initializes the optional extension for an old card',()=>expect(presentationForWrite(null)).toEqual({version:1}));
  it('does not expose media storage keys',()=>expect(toPublicPresentation(stored)?.cover).toEqual({url:stored.cover.url,alt:'Retrato',x:0,y:100}));
  it('rejects javascript media addresses in the stored schema',()=>expect(parsePresentation(JSON.stringify({...stored,cover:{...stored.cover,url:'javascript:alert(1)'}}))).toBeNull());
});
describe('actual server public projection',()=>{
  it('returns only the explicit public fields',()=>expect(Object.keys(projectPublicCard(publicRow)).sort()).toEqual(['description','headline','images','links','name','photo','presentation'].sort()));
  it('projects portfolio records rather than merely casting types',()=>expect(projectPublicCard(publicRow).images).toEqual([{url:'https://example.com/one.jpg',caption:'Obra one'}]));
  it('removes internal fields from links',()=>expect(projectPublicCard(publicRow).links).toEqual([{label:'Instagram',url:'https://instagram.com/exemplo'}]));
  it('rejects unsafe links in a legacy record at the public boundary',()=>expect(projectPublicCard({...publicRow,links:'[{"label":"Bad","url":"javascript:alert(1)"}]'}).links).toEqual([]));
  it('keeps old cards readable without the optional extension',()=>expect(projectPublicCard({...publicRow,presentation:null}).presentation).toBeNull());
});
describe('actual server ordering conflict guard',()=>{
  it('reorders the original server-owned objects',()=>{const current=[work('a'),work('b')];const result=reorderCardWorks(current,['b','a'],['a','b']);expect(result).toEqual([current[1],current[0]]);expect(result[0]).toBe(current[1]);});
  it('rejects an order from before a concurrent upload',()=>expect(()=>reorderCardWorks([work('a'),work('b')],['a'],['a'])).toThrow(/mudou/));
  it('rejects an order from before another reorder',()=>expect(()=>reorderCardWorks([work('b'),work('a')],['b','a'],['a','b'])).toThrow(/mudou/));
  it('rejects duplicate keys',()=>expect(()=>reorderCardWorks([work('a'),work('b')],['a','a'],['a','b'])).toThrow());
  it('rejects a key belonging to another artist',()=>expect(()=>reorderCardWorks([work('a')],['other-artist'],['a'])).toThrow());
});
describe('real editorial renderer',()=>{
  const base={name:'Artista Exemplo',photo:null,headline:'Artista visual',description:'',links:[],images:[]};
  it('renders a valid h1 and no empty sections',()=>{const html=renderToStaticMarkup(createElement(ArtistEditorialCard,base));expect(html).toContain('<h1');expect(html).not.toContain('Sobre o artista');expect(html).not.toContain('Formação e atuação');expect(html).not.toContain('<form');});
  it('numbers only the sections that are present',()=>{const html=renderToStaticMarkup(createElement(ArtistEditorialCard,{...base,links:[{label:'Instagram',url:'https://instagram.com/test'}]}));expect(html).toContain('01 —');expect(html).not.toContain('04 —');expect(html).toContain('Redes e links');});
  it('prefers the explicit cover over the profile avatar',()=>{const html=renderToStaticMarkup(createElement(ArtistEditorialCard,{...base,photo:'https://example.com/avatar.jpg',presentation:toPublicPresentation(stored)}));expect(html).toContain('https://example.com/image.jpg');expect(html).not.toContain('src="https://example.com/avatar.jpg"');});
  it('escapes biography content and does not inject HTML',()=>{const html=renderToStaticMarkup(createElement(ArtistEditorialCard,{...base,description:'<script>alert(1)</script>'}));expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>alert');});
  it('provides buttons to open works using a keyboard',()=>{const html=renderToStaticMarkup(createElement(ArtistEditorialCard,{...base,images:[{url:'https://example.com/work.jpg',caption:'Obra de teste'}]}));expect(html).toContain('aria-label="Abrir Obra de teste"');expect(html).toContain('<button');});
  it('retains the existing HTTPS-only social normalization',()=>{expect(()=>normalizeCardLinks([{label:'Contato',url:'mailto:private@example.com'}])).toThrow();expect(normalizeCardLinks([{label:'',url:''}])).toEqual([]);});
});
