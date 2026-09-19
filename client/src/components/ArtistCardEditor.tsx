import {normalizeCardLinks} from '../../../shared/studioRelations';
import {parsePresentation,toPublicPresentation,type ArtistCardPresentationPublic} from '../../../shared/artistCardPresentation';
import {useState,useEffect,useRef} from 'react';
import {trpc} from '@/lib/trpc';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Textarea} from './ui/textarea';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from './ui/dialog';
import {toast} from 'sonner';
import ArtistEditorialCard from './artist-card/ArtistEditorialCard';

export default function ArtistCardEditor({artistId,name}:{artistId:number,name:string}){
 const [open,setOpen]=useState(false);
 const [previewOpen,setPreviewOpen]=useState(false);
 const utils=trpc.useUtils();
 const q=trpc.studioRelations.card.useQuery({artistId},{enabled:open});
 const [form,setForm]=useState({headline:'',description:'',published:false,links:[] as {label:string,url:string}[],presentation:{quote:'',tagline:'',specialties:'',techniques:'',education:'',experience:'',location:''}});
 const [caption,setCaption]=useState('');
 const [uploading,setUploading]=useState(false);
 const [mediaUploading,setMediaUploading]=useState<string|null>(null);

 const initialized=useRef(false);
 useEffect(()=>{if(!open){initialized.current=false;return;}if(q.isLoading||q.error||initialized.current)return;initialized.current=true;if(q.data)setForm({headline:q.data.headline,description:q.data.description,published:!!q.data.published,links:q.data.links,presentation:{quote:q.data.presentation?.quote||'',tagline:q.data.presentation?.tagline||'',specialties:q.data.presentation?.specialties||'',techniques:q.data.presentation?.techniques||'',education:q.data.presentation?.education||'',experience:q.data.presentation?.experience||'',location:q.data.presentation?.location||''}});else setForm({headline:'',description:'',published:false,links:[],presentation:{quote:'',tagline:'',specialties:'',techniques:'',education:'',experience:'',location:''}});},[open,q.isLoading,q.error,q.data]);

 const refresh=()=>utils.studioRelations.card.invalidate({artistId});
const updateMediaFocal=trpc.studioRelations.updateMediaFocal.useMutation({onSuccess:refresh,onError:e=>toast.error(e.message)});
 const save=trpc.studioRelations.saveCard.useMutation({onSuccess:()=>{refresh();toast.success('Cartão salvo.');},onError:e=>toast.error(e.message)});
 const upload=trpc.studioRelations.uploadWork.useMutation({onSuccess:()=>{refresh();setCaption('');toast.success('Trabalho salvo no portfólio.');},onError:e=>toast.error(e.message)});
 const remove=trpc.studioRelations.removeWork.useMutation({onSuccess:refresh,onError:e=>toast.error(e.message)});
 const uploadMedia=trpc.studioRelations.uploadPresentationMedia.useMutation({onSuccess:()=>{refresh();toast.success('Mídia salva.');},onError:e=>toast.error(e.message)});
 const removeMedia=trpc.studioRelations.removePresentationMedia.useMutation({onSuccess:refresh,onError:e=>toast.error(e.message)});

 return <><Button size="sm" variant="outline" onClick={e=>{e.stopPropagation();setOpen(true);}}>Cartão virtual</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent onClick={e=>e.stopPropagation()} className="max-h-[90dvh] overflow-y-auto max-w-4xl"><DialogHeader><DialogTitle>Cartão virtual · {name}</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Somente nome, avatar, apresentação, redes e trabalhos deste cartão serão públicos. Quando estiver publicado, o envio poderá ser escolhido em cada agendamento.</p>{q.error?<p role="alert">Não foi possível carregar o cartão.</p>:q.isLoading?<p>Carregando…</p>:<><div className="grid gap-6 md:grid-cols-2"><div><form className="space-y-3" onSubmit={e=>{e.preventDefault();try{const links=normalizeCardLinks(form.links);setForm({...(form || {}), links});save.mutate({artistId,...form,links,presentation:form.presentation});}catch(error){toast.error((error as Error).message);}}}>
 <label className="block"><span className="text-sm font-medium">Título / especialidade</span><Input maxLength={160} value={form.headline} onChange={e=>setForm({...form,headline:e.target.value})}/></label>
 <label className="block"><span className="text-sm font-medium">Apresentação</span><Textarea value={form.description} maxLength={3000} onChange={e=>setForm({...form,description:e.target.value})}/></label>
 <div><span className="text-sm font-medium block mb-2">Apresentação Editorial (opcional)</span>
  <label className="block mb-2"><span className="text-xs">Quote (180 caracteres)</span><Textarea maxLength={180} value={form.presentation.quote} onChange={e=>setForm({...form,presentation:{...form.presentation,quote:e.target.value}})}/></label>
  <label className="block mb-2"><span className="text-xs">Tagline (180 caracteres)</span><Input maxLength={180} value={form.presentation.tagline} onChange={e=>setForm({...form,presentation:{...form.presentation,tagline:e.target.value}})}/></label>
  <label className="block mb-2"><span className="text-xs">Especialidades (500 caracteres)</span><Textarea maxLength={500} rows={2} value={form.presentation.specialties} onChange={e=>setForm({...form,presentation:{...form.presentation,specialties:e.target.value}})}/></label>
  <label className="block mb-2"><span className="text-xs">Técnicas (500 caracteres)</span><Textarea maxLength={500} rows={2} value={form.presentation.techniques} onChange={e=>setForm({...form,presentation:{...form.presentation,techniques:e.target.value}})}/></label>
  <label className="block mb-2"><span className="text-xs">Formação (1200 caracteres)</span><Textarea maxLength={1200} rows={3} value={form.presentation.education} onChange={e=>setForm({...form,presentation:{...form.presentation,education:e.target.value}})}/></label>
  <label className="block mb-2"><span className="text-xs">Experiência (700 caracteres)</span><Textarea maxLength={700} rows={3} value={form.presentation.experience} onChange={e=>setForm({...form,presentation:{...form.presentation,experience:e.target.value}})}/></label>
  <label className="block"><span className="text-xs">Local de Atuação (200 caracteres)</span><Input maxLength={200} value={form.presentation.location} onChange={e=>setForm({...form,presentation:{...form.presentation,location:e.target.value}})}/></label>
 </div>
 <h3>Redes sociais e links</h3>{form.links.map((l,i)=><div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] rounded-lg border p-3" key={i}><label className="min-w-0 text-sm"><span>Nome da rede (opcional)</span><Input maxLength={40} aria-label={`Nome da rede ${i+1}`} placeholder="Preenchido a partir do link" value={l.label} onChange={e=>setForm({...(form || {}), links:form.links.map((x,j)=>j===i?{...x,label:e.target.value}:x)})}/></label><label className="min-w-0 text-sm"><span>Link completo</span><Input aria-label={`URL da rede ${i+1}`} placeholder="https://www.instagram.com/seuusuario" maxLength={500} type="text" inputMode="url" value={l.url} onChange={e=>setForm({...form,links:form.links.map((x,j)=>j===i?{...x,url:e.target.value}:x)})}/></label><Button type="button" variant="outline" onClick={()=>setForm({...form,links:form.links.filter((_,j)=>j!==i)})}>Remover</Button></div>)}<Button type="button" variant="outline" disabled={form.links.length>=8} onClick={()=>setForm({...form,links:[...form.links,{label:'',url:''}]})}>Adicionar rede social</Button>
 <label className="flex gap-2"><input type="checkbox" checked={form.published} onChange={e=>setForm({...form,published:e.target.checked})}/>Publicar cartão para disponibilizá-lo nos agendamentos</label>
 <div className="flex gap-2"><Button disabled={save.isPending||uploading||upload.isPending||mediaUploading}>Salvar cartão</Button>{q.data?.published===1&&<a className="underline break-all inline-flex items-center text-sm" target="_blank" rel="noreferrer" href={`/artista/${q.data.token}`}>Abrir cartão público →</a>}</div>
 </form></div>

 <div className="space-y-4">
 <div>
  <h3 className="font-semibold mb-2">Portfólio · até 12 trabalhos</h3>
  <p className="text-sm">Envie somente imagens autorizadas para divulgação. JPG, PNG ou WebP de até 5 MB.</p>
  <p className="text-sm text-muted-foreground">Você já pode adicionar imagens. Elas são salvas ao enviar; use Salvar cartão para guardar os textos e publicar.</p>
  <Input aria-label="Legenda do trabalho" placeholder="Legenda do trabalho" value={caption} maxLength={160} onChange={e=>setCaption(e.target.value)} className="mb-2"/>
  <Input aria-label="Enviar imagem do portfólio" type="file" accept="image/jpeg,image/png,image/webp" disabled={save.isPending||uploading||upload.isPending||(q.data?.images.length||0)>=12} onChange={async e=>{const input=e.currentTarget;const file=input.files?.[0];if(!file)return;if(file.size>5*1024*1024){toast.error('Limite de 5 MB.');return;}setUploading(true);try{const imageBase64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file);});await upload.mutateAsync({artistId,caption,imageBase64,mimeType:file.type as any});}catch(error){if(!(error instanceof Error)||!('data' in error))toast.error('Não foi possível enviar a imagem. Tente novamente.');}finally{setUploading(false);input.value='';}}}/>
  <div className="grid grid-cols-2 gap-3 mt-3">{q.data?.images.map(img=><figure key={img.key} className="border rounded"><img src={img.url} alt={img.caption||'Trabalho do artista'} className="rounded w-full aspect-square object-cover"/><figcaption className="text-xs p-2">{img.caption}</figcaption><Button size="sm" variant="outline" disabled={remove.isPending} onClick={()=>remove.mutate({artistId,key:img.key})} className="w-full">Retirar</Button></figure>)}</div>
 </div>

 <div>
  <h3 className="font-semibold mb-2">Mídias Editoriais (opcional)</h3>
  <p className="text-sm text-muted-foreground">Foto de apresentação (cover), sobre (about) e processo (process). Uma imagem por slot. Controles de enquadramento (x/y).</p>
  {(['cover','about','process'] as const).map(slot=><div key={slot} className="border rounded p-3 mb-3">
   <div className="flex justify-between items-center mb-2">
    <span className="text-sm font-medium capitalize">{slot}</span>
    {q.data?.presentation?.[slot]&&<Button size="sm" variant="outline" disabled={removeMedia.isPending} onClick={()=>removeMedia.mutate({artistId,slot})}>Remover</Button>}
   </div>
   {q.data?.presentation?.[slot]?(
    <div className="space-y-2">
     <img src={q.data.presentation[slot]!.url} alt={q.data.presentation[slot]!.alt} className="w-full aspect-square object-cover rounded border"/>
     <label className="block text-sm"><span>Alt text</span><Input maxLength={200} defaultValue={q.data.presentation[slot]!.alt} onBlur={e=>updateMediaFocal.mutate({artistId,slot,expectedKey:q.data?.presentation?.[slot]?.key||'',alt:e.currentTarget.value,x:(q.data?.presentation?.[slot]?.x||50),y:(q.data?.presentation?.[slot]?.y||50)})}/>
     </label>
     <label className="block text-sm"><span>Focal X (0-100%)</span><Input type="range" min="0" max="100" defaultValue={q.data.presentation[slot]!.x} onBlur={e=>updateMediaFocal.mutate({artistId,slot,expectedKey:q.data?.presentation?.[slot]?.key||'',alt:q.data?.presentation?.[slot]?.alt||'',x:Number(e.currentTarget.value),y:(q.data?.presentation?.[slot]?.y||50)})} className="w-full"/>
     </label>
     <label className="block text-sm"><span>Focal Y (0-100%)</span><Input type="range" min="0" max="100" defaultValue={q.data.presentation[slot]!.y} onBlur={e=>updateMediaFocal.mutate({artistId,slot,expectedKey:q.data?.presentation?.[slot]?.key||'',alt:q.data?.presentation?.[slot]?.alt||'',x:(q.data?.presentation?.[slot]?.x||50),y:Number(e.currentTarget.value)})} className="w-full"/>
     </label>
    </div>
   ):(
    <Input aria-label={`Enviar imagem ${slot}`} type="file" accept="image/jpeg,image/png,image/webp" disabled={mediaUploading===slot} onChange={async e=>{const input=e.currentTarget;const file=input.files?.[0];if(!file)return;if(file.size>5*1024*1024){toast.error('Limite de 5 MB.');return;}setMediaUploading(slot);try{const imageBase64=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file);});await uploadMedia.mutateAsync({artistId,slot,alt:`Imagem ${slot}`,x:50,y:50,imageBase64,mimeType:file.type as any});}catch(error){toast.error('Não foi possível enviar. Tente novamente.');}finally{setMediaUploading(null);input.value='';}}}/>
   )}
  </div>)}
 </div>
 </div></div>

 <Button variant="outline" onClick={()=>setPreviewOpen(true)} className="mt-4 w-full">Ver prévia editorial</Button>
 </>}</DialogContent></Dialog>{previewOpen&&q.data&&<Dialog open={previewOpen} onOpenChange={setPreviewOpen}><DialogContent className="max-w-full w-screen max-h-screen overflow-y-auto p-0"><ArtistEditorialCard name={q.data.artistName||name} photo={q.data.artistPhoto} headline={q.data.headline} description={q.data.description} links={q.data.links} images={q.data.images} presentation={toPublicPresentation(q.data.presentation)} idPrefix="preview"/></DialogContent></Dialog>}</>;
}

