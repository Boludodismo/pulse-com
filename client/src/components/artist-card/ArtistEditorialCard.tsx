import {useId, useRef, useState, useEffect} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {ArrowUpRight, ChevronLeft, ChevronRight, Instagram, Link2, MessageCircle, X, Youtube} from 'lucide-react';
import type {ArtistCardPresentationPublic, PublicMedia} from '../../../../shared/artistCardPresentation';
import styles from './ArtistEditorialCard.module.css';

export interface ArtistEditorialCardProps {
  name: string;
  photo?: string | null;
  headline: string;
  description: string;
  links: Array<{label: string; url: string}>;
  images: Array<{url: string; caption: string}>;
  presentation?: ArtistCardPresentationPublic | null;
  idPrefix?: string;
}
const text = (value?: string | null) => value?.trim() || '';
function safeLink(value: string) {
  try {const u=new URL(value); return u.protocol==='https:'&&!u.username&&!u.password;} catch {return false;}
}
function formatName(value: string) {
  const words=value.trim().split(/\s+/); if(words.length<2)return value;
  let at=1, distance=Infinity;
  for(let i=1;i<words.length;i++){const d=Math.abs(words.slice(0,i).join(' ').length-words.slice(i).join(' ').length);if(d<distance){at=i;distance=d;}}
  return words.slice(0,at).join(' ')+'\n'+words.slice(at).join(' ');
}
function Monogram({name}:{name:string}) {
  const words=name.split(/\s+/).filter(w=>w&&!['de','da','do','dos','das','e'].includes(w.toLowerCase()));
  return <>{(words.length>1?[words[0],words.at(-1)!]:words).map(w=>w[0]).join('').toUpperCase()}</>;
}
function SocialIcon({url}:{url:string}) {
  const host=new URL(url).hostname.replace(/^www\./,'');
  if(host==='instagram.com')return <Instagram aria-hidden="true"/>;
  if(host==='youtube.com'||host==='youtu.be')return <Youtube aria-hidden="true"/>;
  if(host==='wa.me'||host==='api.whatsapp.com')return <MessageCircle aria-hidden="true"/>;
  return <Link2 aria-hidden="true"/>;
}
function Photo({url,alt,className,x=50,y=50,priority=false}:{url:string;alt:string;className?:string;x?:number;y?:number;priority?:boolean}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[url]);
  if(failed)return <div className={`${className||''} ${styles.imageMissing}`} role="img" aria-label={`${alt}. Imagem indisponível.`}><span>Imagem indisponível</span></div>;
  return <img src={url} alt={alt} className={className} style={{objectPosition:`${x}% ${y}%`}} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async" onError={()=>setFailed(true)}/>;
}
export default function ArtistEditorialCard({name,photo,headline,description,links,images,presentation:p,idPrefix:given}:ArtistEditorialCardProps) {
  const auto=useId().replace(/[^a-zA-Z0-9_-]/g,''); const prefix=given||`artist-${auto}`;
  const gallery=useRef<HTMLDivElement>(null);
  const returnFocus=useRef<HTMLButtonElement|null>(null);
  const [selected,setSelected]=useState<number|null>(null);
  const works=images.filter(i=>text(i.url)).slice(0,12);
  const socials=links.filter(l=>safeLink(l.url)).slice(0,8);
  const cover:PublicMedia|null=p?.cover|| (photo?{url:photo,alt:`Retrato de ${name}`,x:50,y:50}:null);
  const credentials=([
    ['Especialidades',p?.specialties],['Técnicas',p?.techniques],['Formação',p?.education],['Experiência',p?.experience],['Local de atuação',p?.location]
  ] as const).filter(([,value])=>text(value));
  const sections=[
    ...(text(description)||text(p?.quote)||p?.about?.url?[{id:'sobre',label:'Sobre',title:'Sobre o artista'}]:[]),
    ...(credentials.length?[{id:'formacao',label:'Formação',title:'Formação e atuação'}]:[]),
    ...(works.length?[{id:'trabalhos',label:'Trabalhos',title:'Trabalhos selecionados'}]:[]),
    ...(socials.length?[{id:'redes',label:'Redes e links',title:'Redes e links'}]:[])
  ];
  const has=(id:string)=>sections.some(s=>s.id===id);
  const heading=(id:string)=>{const i=sections.findIndex(s=>s.id===id),s=sections[i];return <div className={styles.sectionHeading}><span className={styles.sectionNumber} aria-hidden="true">{String(i+1).padStart(2,'0')} —</span><h2 id={`${prefix}-${id}-title`}>{s.title}</h2></div>;};
  const nav=(label:string)=><nav className={styles.nav} aria-label={label}>{sections.map(s=><a key={s.id} href={`#${prefix}-${s.id}`}>{s.label}</a>)}</nav>;
  useEffect(()=>{if(selected!==null&&selected>=works.length)setSelected(null);},[selected,works.length]);
  const active=selected===null?null:works[selected];
  const move=(direction:number)=>setSelected(i=>i===null||!works.length?null:(i+direction+works.length)%works.length);
  const scroll=(direction:number)=>gallery.current?.scrollBy({left:gallery.current.clientWidth*.85*direction,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  return <article className={styles.card} id={`${prefix}-inicio`}>
    <section className={`${styles.hero} ${cover?'':styles.noHeroPhoto}`} aria-label="Apresentação do artista">
      {cover&&<Photo {...cover} alt={cover.alt||`Retrato de ${name}`} className={styles.heroPhoto} priority/>}
      <div className={styles.heroShade}/>
      <header className={`${styles.header} ${styles.wrap}`}><a href={`#${prefix}-inicio`} className={styles.monogram} aria-label="Início da apresentação"><Monogram name={name}/></a>{nav('Seções do cartão')}</header>
      <div className={`${styles.heroInner} ${styles.wrap}`}><div><h1 className={name.length>27?styles.longName:undefined}>{formatName(name)}</h1>{text(headline)&&<p className={styles.eyebrow}>{headline}</p>}</div>{text(p?.tagline)&&<div className={styles.heroSide}><p>{p?.tagline}</p><div className={styles.accentRule}/></div>}</div>
    </section>
    {has('sobre')&&<section className={`${styles.section} ${styles.wrap}`} id={`${prefix}-sobre`} aria-labelledby={`${prefix}-sobre-title`}>{heading('sobre')}<div className={`${styles.aboutGrid} ${p?.about?'':styles.noPhoto}`}>{p?.about&&<Photo {...p.about} alt={p.about.alt||`Apresentação de ${name}`} className={`${styles.editorialPhoto} ${styles.aboutPhoto}`}/>}<div>{text(description)&&<p className={styles.bodyCopy}>{description}</p>}{text(p?.quote)&&<blockquote>{p?.quote}</blockquote>}</div></div></section>}
    {has('formacao')&&<section className={`${styles.section} ${styles.wrap}`} id={`${prefix}-formacao`} aria-labelledby={`${prefix}-formacao-title`}>{heading('formacao')}<div className={`${styles.credentialsGrid} ${p?.process?'':styles.noPhoto}`}>{p?.process&&<Photo {...p.process} alt={p.process.alt||'Processo de trabalho do artista'} className={`${styles.editorialPhoto} ${styles.processPhoto}`}/>}<dl className={styles.credentials}>{credentials.map(([label,value],i)=><div key={label} className={styles.credential}><span className={styles.credentialIndex} aria-hidden="true">{String(i+1).padStart(2,'0')}</span><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div></section>}
    {has('trabalhos')&&<section className={`${styles.section} ${styles.wrap}`} id={`${prefix}-trabalhos`} aria-labelledby={`${prefix}-trabalhos-title`}>{heading('trabalhos')}<div className={styles.gallery} ref={gallery}>{works.map((image,i)=><figure className={styles.work} key={`${image.url}-${i}`}><button type="button" onClick={e=>{returnFocus.current=e.currentTarget;setSelected(i);}} aria-label={`Abrir ${image.caption||`trabalho ${i+1}`}`}><Photo url={image.url} alt={image.caption||`Trabalho ${i+1}`} className={styles.workPhoto}/></button>{image.caption&&<figcaption>{image.caption}</figcaption>}</figure>)}</div><div className={styles.galleryFooter}><span>Toque na imagem para ver o trabalho completo.</span><div className={styles.galleryControls}><button type="button" onClick={()=>scroll(-1)} aria-label="Trabalhos anteriores"><ChevronLeft/></button><button type="button" onClick={()=>scroll(1)} aria-label="Próximos trabalhos"><ChevronRight/></button></div></div></section>}
    {has('redes')&&<section className={`${styles.section} ${styles.wrap}`} id={`${prefix}-redes`} aria-labelledby={`${prefix}-redes-title`}>{heading('redes')}<nav className={styles.socialList} aria-label="Redes sociais do artista">{socials.map((link,i)=><a key={`${link.url}-${i}`} className={styles.socialLink} href={link.url} target="_blank" rel="noopener noreferrer"><span className={styles.socialIcon}><SocialIcon url={link.url}/></span><span className={styles.socialLabel}>{link.label||new URL(link.url).hostname}</span><span className={styles.socialAddress}>{link.url.replace(/^https:\/\/(www\.)?/,'').replace(/\/$/,'')}</span><ArrowUpRight className={styles.socialArrow} aria-hidden="true"/></a>)}</nav></section>}
    <footer className={`${styles.footer} ${styles.wrap}`}><div><div className={styles.footerName}>{name}</div><div className={styles.footerLabel}>Cartão de apresentação do artista</div></div>{nav('Navegação do rodapé')}</footer>
    <Dialog.Root open={selected!==null&&!!active} onOpenChange={open=>{if(!open)setSelected(null);}}><Dialog.Portal><Dialog.Overlay className={styles.lightboxOverlay}/>{active&&<Dialog.Content className={styles.lightbox} aria-describedby={active.caption?`${prefix}-image-description`:undefined} onCloseAutoFocus={e=>{e.preventDefault();returnFocus.current?.focus();}} onKeyDown={e=>{if(e.key==='ArrowRight'){e.preventDefault();move(1);}else if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}}}><div className={styles.lightboxHeader}><Dialog.Title className={styles.lightboxTitle}>Trabalho {(selected??0)+1} de {works.length}</Dialog.Title><Dialog.Close className={styles.lightboxClose} aria-label="Fechar imagem"><X/></Dialog.Close></div><Photo key={active.url} url={active.url} alt={active.caption||'Trabalho do artista'} className={styles.lightboxImage} priority/><div className={styles.lightboxFooter}>{active.caption?<Dialog.Description id={`${prefix}-image-description`}>{active.caption}</Dialog.Description>:<span/>}<div className={styles.galleryControls}><button type="button" onClick={()=>move(-1)} aria-label="Imagem anterior"><ChevronLeft/></button><button type="button" onClick={()=>move(1)} aria-label="Próxima imagem"><ChevronRight/></button></div></div></Dialog.Content>}</Dialog.Portal></Dialog.Root>
  </article>;
}
