/** Browser assets for the isolated Cores na Pele reader. */
export const SYNC_JS=String.raw`/* Cores na Pele 2.0 — tempos originais do SRT; sem estimar tempos por palavra. */
(() => {
  'use strict';
  if (window.CoresSync) return;
  const $=id=>document.getElementById(id), bridge=window.CoresReaderBridge;
  const audio=$('audio'), reader=$('reader'), scroller=$('readingScroll');
  if(!bridge||!audio||!reader)return;
  const book=JSON.parse($('bookData').textContent), source=new URL(book.audio,location.href).href;
  let data=null, follow=true, active=-1, started=false, compatible=true, internal=false;
  let lastScroll=-1, frame=0, touchY=0, decoratedPage=0, decoratedRoot=null, blocked=0;
  const byBlock=new Map(), byPage=new Map(), key=book.id+':srt-follow:v2';
  try{follow=localStorage.getItem(key)!=='off';}catch(_){}
  const bar=document.createElement('div');bar.className='cs-bar';
  bar.innerHTML='<button id="csFollow" type="button" aria-pressed="true" disabled>Acompanhando</button><button id="csListenPage" type="button" disabled>Ouvir esta página</button><span id="csReady" class="sr-only" role="status">Carregando legendas…</span>';
  document.querySelector('.top').append(bar);
  const caption=document.createElement('div');caption.className='cs-caption';
  caption.innerHTML='<span class="cs-caption-label">TRECHO NARRADO</span><p id="csCaption">Carregando as legendas da narração…</p>';
  $('player').prepend(caption);
  const info=document.createElement('div');info.className='cs-info';
  info.innerHTML='<h3>Leitura acompanhada · versão 2.0</h3><p>O destaque usa os tempos das legendas exportadas do ElevenLabs: são trechos, não palavras individuais. Toque em um trecho para ouvi-lo. Role ou navegue para pausar o acompanhamento; use Acompanhar para retomá-lo.</p><p>No modo Original, a página acompanha o áudio, sem marcações sobre a imagem. Todas as imagens da apostila foram preservadas.</p><p>O PDF termina com abril de 2025; a narração termina com 2026. Cada fonte foi mantida. Instruções técnicas de pausa foram removidas somente da exibição das legendas, sem alterar os tempos.</p>';
  $('panelSettings').append(info);$('followCheck').disabled=true;
  function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
  function nodes(root){return[...root.querySelectorAll('p,h1,h2,h3,li')].filter(el=>!el.parentElement.closest('p,h1,h2,h3,li')&&!el.closest('.reading-note,.page-end'));}
  function validate(d){
    if(d.version!=='2.0.0'||d.bookId!==book.id||d.timing!=='subtitle-intervals-not-word-timing'||!Array.isArray(d.packed)||d.packed.length!==1114||!Array.isArray(d.blocks)||d.blocks.length!==343||Math.abs(d.audioDuration-book.duration)>.2)throw Error('Mapa incompatível.');
    const raw=new Map(), texts=[];
    for(const p of book.pages){const root=document.createElement('div');root.innerHTML=p.html;raw.set(p.n,nodes(root));}
    d.blocks.forEach((b,i)=>{const el=raw.get(b[0])?.[b[1]];if(!el||hash(el.textContent)!==b[2])throw Error('O texto não corresponde ao mapa.');texts.push(el.textContent);byBlock.set(i,[]);if(!byPage.has(b[0]))byPage.set(b[0],[]);byPage.get(b[0]).push(i);});
    // Lossless compression: reconstruct the original subtitle text using exact book slices and residual edits.
    d.cues=d.packed.map(c=>{const raw=c[3].map(r=>texts[r[0]].slice(r[1],r[2])).join(' ').replace(/\s+/g,' ').trim();let s=raw;for(const e of [...c[4]].reverse())s=s.slice(0,e[0])+e[2]+s.slice(e[1]);return[c[0],c[0]+c[1],c[2],s,c[3]];});
    let end=0;
    d.cues.forEach((c,i)=>{if(!Number.isInteger(c[0])||!Number.isInteger(c[1])||c[0]<end||c[1]<=c[0]||c[1]>d.audioDuration*1000+100||c[2]<1||c[2]>27||c[3].length>1000)throw Error('Intervalo inválido.');end=c[1];
      c[4].forEach(r=>{if(!d.blocks[r[0]]||!Number.isInteger(r[1])||!Number.isInteger(r[2])||r[1]<0||r[2]<=r[1]||r[2]>texts[r[0]].length)throw Error('Trecho inválido.');byBlock.get(r[0]).push({start:r[1],end:r[2],cue:i});});
    });
    for(const rs of byBlock.values()){rs.sort((a,b)=>a.start-b.start);for(let i=1;i<rs.length;i++)if(rs[i].start<rs[i-1].end)throw Error('Textos sobrepostos.');}
    return d;
  }
  function cueAt(t){if(!data||!Number.isFinite(t))return-1;let lo=0,hi=data.cues.length-1,found=-1;while(lo<=hi){const mid=(lo+hi)>>>1;if(data.cues[mid][0]/1000<=t){found=mid;lo=mid+1;}else hi=mid-1;}return found>=0&&t<data.cues[found][1]/1000?found:-1;}
  function clear(){reader.querySelectorAll('.cs-active').forEach(el=>{el.classList.remove('cs-active');el.removeAttribute('aria-current');});}
  function decorate(){
    if(!data||reader.hidden||bridge.getPage()===1)return;
    if(decoratedPage===bridge.getPage()&&decoratedRoot===reader.firstElementChild)return;
    decoratedPage=bridge.getPage();decoratedRoot=reader.firstElementChild;const els=nodes(reader);
    for(const bi of byPage.get(decoratedPage)||[]){const b=data.blocks[bi],el=els[b[1]],rs=byBlock.get(bi);if(!el||hash(el.textContent)!==b[2]){blocked++;continue;}if(!rs?.length)continue;
      el.dataset.csFirst=String(rs[0].cue);el.tabIndex=0;el.title='Toque no trecho para ouvir';
      const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),list=[];let node;while((node=walker.nextNode()))list.push(node);let offset=0;
      for(const n of list){const text=n.nodeValue,begin=offset,end=begin+text.length;offset=end;const hits=rs.filter(r=>r.start<end&&r.end>begin);if(!hits.length)continue;const f=document.createDocumentFragment();let used=0;
        for(const r of hits){const a=Math.max(0,r.start-begin),b=Math.min(text.length,r.end-begin);if(a>used)f.append(document.createTextNode(text.slice(used,a)));const span=document.createElement('span');span.className='cs-fragment';span.dataset.csCue=String(r.cue);span.textContent=text.slice(a,b);f.append(span);used=b;}
        if(used<text.length)f.append(document.createTextNode(text.slice(used)));n.replaceWith(f);
      }
    }
  }
  function scrollActive(force){if(!follow||!started||reader.hidden||active<0||(!force&&lastScroll===active))return;const target=reader.querySelector('[data-cs-cue="'+active+'"]');if(!target)return;lastScroll=active;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(!follow||!target.isConnected||$('toolsDialog').open)return;const r=target.getBoundingClientRect(),b=scroller.getBoundingClientRect();if(force||r.top<b.top+18||r.bottom>b.bottom-28)scroller.scrollTo({top:Math.max(0,scroller.scrollTop+r.top-b.top-28),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});}
  function refresh(force=false){
    if(!data)return;const idx=compatible?cueAt(audio.currentTime):-1,changed=idx!==active;active=idx;const c=idx>=0?data.cues[idx]:null;
    $('csFollow').disabled=!compatible;$('csListenPage').disabled=!compatible;$('csFollow').textContent=follow?'Acompanhando':'Acompanhar';$('csFollow').setAttribute('aria-pressed',String(follow));$('syncStatus').textContent=!compatible?'Outro áudio':follow?'Trechos sincronizados':'Navegação livre';
    $('csCaption').textContent=!compatible?'Outro áudio selecionado. Reabra o leitor para usar a sincronização original.':!started?'Toque em reproduzir para acompanhar a leitura.':c?.[3]||(audio.ended?'Fim da narração.':'Pausa na narração.');
    if(!follow||!compatible||!started){clear();return;}if($('toolsDialog').open)return;
    if(c&&bridge.getPage()!==c[2]){internal=true;bridge.goPage(c[2]);internal=false;force=true;}
    decorate();if(changed||force){clear();if(c)reader.querySelectorAll('[data-cs-cue="'+idx+'"]').forEach(el=>{el.classList.add('cs-active');el.setAttribute('aria-current','true');});scrollActive(force);}
  }
  function setFollow(v){follow=!!v&&compatible&&!!data;if(follow)bridge.disableLegacy();try{localStorage.setItem(key,follow?'on':'off');}catch(_){}lastScroll=-1;refresh(true);}
  function stop(){if(follow&&!internal)setFollow(false);}
  function jump(i){const c=data?.cues[i];if(!compatible||!c)return;started=true;setFollow(true);bridge.seek(c[0]/1000);bridge.play();refresh(true);}
  $('csFollow').onclick=()=>{started=true;setFollow(!follow);};$('csListenPage').onclick=()=>{const i=data?.cues.findIndex(c=>c[2]===bridge.getPage()&&c[3]);if(i>=0)jump(i);};
  reader.addEventListener('click',e=>{if(window.getSelection()?.toString())return;const el=e.target.closest('[data-cs-cue]');if(el){e.preventDefault();jump(+el.dataset.csCue);}});
  reader.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key))return;const el=e.target.closest('[data-cs-first]');if(el){e.preventDefault();e.stopPropagation();jump(+el.dataset.csFirst);}});
  document.addEventListener('cores:navigate',stop);document.addEventListener('cores:page',()=>{decorate();if(!internal)refresh(true);});
  scroller.addEventListener('wheel',stop,{passive:true});scroller.addEventListener('touchstart',e=>{touchY=e.touches[0]?.clientY||0;},{passive:true});scroller.addEventListener('touchmove',e=>{if(Math.abs((e.touches[0]?.clientY||0)-touchY)>10)stop();},{passive:true});scroller.addEventListener('keydown',e=>{if(['PageDown','PageUp','Home','End','ArrowDown','ArrowUp'].includes(e.key))stop();});
  audio.addEventListener('play',()=>{started=true;refresh(true);});audio.addEventListener('seeking',()=>{started=true;lastScroll=-1;refresh(true);});for(const e of ['timeupdate','seeked','pause','ended','ratechange'])audio.addEventListener(e,()=>refresh());
  audio.addEventListener('loadedmetadata',()=>{compatible=audio.src===source&&Math.abs(audio.duration-book.duration)<.2;if(!compatible)follow=false;if(audio.currentTime>0)started=true;refresh(true);});
  $('audioInput').addEventListener('change',()=>{compatible=false;follow=false;refresh(true);});$('toolsDialog').addEventListener('close',()=>refresh(true));document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);});window.addEventListener('resize',()=>{lastScroll=-1;refresh(true);});
  window.CoresSync={cueAt,refresh:()=>refresh(true),diagnostics:()=>({version:'2.0.0',ready:!!data,cues:data?.cues.length||0,activeCue:active+1,page:bridge.getPage(),follow,compatible,blocked,highlighted:reader.querySelectorAll('.cs-active').length})};
  fetch('sync-data.json?v=2.0.0',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Mapa indisponível.');return r.json();}).then(d=>{data=validate(d);bridge.disableLegacy();compatible=audio.src===source&&(!Number.isFinite(audio.duration)||Math.abs(audio.duration-book.duration)<.2);started=!audio.paused||audio.currentTime>0;$('csReady').textContent='Legendas prontas para acompanhar a leitura.';decorate();refresh(true);}).catch(err=>{data=null;clear();$('csFollow').disabled=true;$('csListenPage').disabled=true;$('csFollow').textContent='Sem sincronização';$('csCaption').textContent='As legendas não carregaram. Atualize a página; o áudio e a apostila continuam disponíveis.';$('csReady').textContent='Não foi possível carregar as legendas.';console.warn('[CoresSync]',err.message);});
})();
`;
export const SYNC_CSS=String.raw`.cs-bar{display:flex;align-items:center;gap:8px;padding:8px 0 10px;flex-wrap:wrap}.cs-bar button{min-height:40px;border:1px solid var(--line);border-radius:20px;padding:7px 13px;font-size:12px;font-weight:650;background:var(--paper);color:var(--ink)}.cs-bar button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--paper)}.cs-caption{padding:8px 2px 11px;border-bottom:1px solid #ffffff22;margin-bottom:4px}.cs-caption-label{font-size:9px;letter-spacing:1.4px;opacity:.72;display:block;margin-bottom:5px}.cs-caption p{font-size:13px;line-height:1.45;margin:0;min-height:36px;max-height:76px;overflow:auto;color:var(--player-ink)}.cs-fragment{border-radius:3px;box-decoration-break:clone;-webkit-box-decoration-break:clone;cursor:pointer}.cs-fragment.cs-active{background:#f5d884;color:#203c40;box-shadow:0 0 0 2px #f5d884}body.dark .cs-fragment.cs-active{background:#f5d884;color:#152c30}.reader [data-cs-first]:focus-visible{outline:2px solid var(--accent);outline-offset:4px}.cs-info{border-top:1px solid var(--line);padding-top:12px;margin-top:20px}@media(max-width:390px){.cs-bar{gap:6px}.cs-bar button{padding:7px 10px}.cs-caption p{font-size:12px;max-height:70px}.cs-caption{padding-top:6px;padding-bottom:8px}}@media(max-height:650px){.cs-caption-label{display:none}.cs-caption p{min-height:22px;max-height:40px;font-size:11px}.cs-bar{padding:4px 0 6px}.cs-bar button{min-height:32px}.top{padding-top:6px}}@media(prefers-reduced-motion:reduce){.reading-scroll{scroll-behavior:auto}}
`;
