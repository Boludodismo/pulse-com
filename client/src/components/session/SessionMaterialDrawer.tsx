import type {ReactNode} from 'react';
import {ChevronLeft} from 'lucide-react';

/** Material controls stay beside the selected material rail, outside the canvas gestures. */
export default function SessionMaterialDrawer({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) {
 return <aside className="session-material-drawer" aria-label={title} onPointerDown={event=>event.stopPropagation()}>
  <header><h2>{title}</h2><button type="button" aria-label="Recolher aba de materiais" onClick={onClose}><ChevronLeft size={20}/></button></header>
  <div className="session-material-drawer-scroll">{children}</div>
 </aside>;
}
