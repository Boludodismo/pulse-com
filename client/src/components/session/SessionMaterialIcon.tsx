import { recordedColor, type MaterialSymbol } from "@shared/sessionAppearance";

/** Original line icons. Color only fills the ink/cup contents, never the material outline. */
export default function SessionMaterialIcon({symbol,color}:{symbol:MaterialSymbol;color?:string}) {
  const accent="var(--session-orange, #f97316)", pigment=recordedColor(color);
  const paths: Partial<Record<MaterialSymbol,React.ReactNode>> = {
    ink:<><path d="M20 17V9h8v8M22 9V4h4v5M18 17h12v6H18zM17 23h14l3 6v14H14V29z"/><path d="M15 31h18v10H15z" fill={pigment??"none"} stroke={pigment?"currentColor":accent}/><path d="M24 26c-3 4-4 5-4 7a4 4 0 0 0 8 0c0-2-1-3-4-7Z" fill={pigment??"none"}/></>,
    cup:<><path d="M8 12l5 27c1 5 21 5 22 0l5-27"/><path d="M12 24l3 14c0 2 18 2 18 0l3-14Z" fill={pigment??"none"} stroke={pigment?"currentColor":accent}/><ellipse cx="24" cy="12" rx="16" ry="5"/></>,
    cream:<><path d="M10 21h28v20H10zM13 21v-7h22v7M16 14c0-8 8-3 7-10 7 3 10 5 10 10"/><path d="M17 27h14v8H17z" stroke={accent}/></>,
    gloves:<><path d="M7 37 4 24q-1-4 2-3l4 8-1-18q0-4 3-1l2 14V7q2-4 3 0l1 16 1-13q2-4 3 0l-1 19-2 9ZM29 38l-3-10V13q2-3 3 0l1 13 1-18q2-3 3 0v17l2-14q2-3 3 0l-1 17 3-6q3-1 2 2l-5 14"/><path d="m7 38 12-1 1 5-12 1ZM29 38h10v5H29Z" stroke={accent}/></>,
    diluent:<><path d="M18 5h12v7H18zM18 12v5l-5 7v18h22V24l-5-7v-5"/><path d="M24 23c-7 9-7 15 0 15s7-6 0-15Z" stroke={accent}/></>,
    paper:<><ellipse cx="17" cy="10" rx="11" ry="5"/><path d="M6 10v28c0 7 22 7 22 0V10M28 16l13 4v23l-13-5"/><ellipse cx="17" cy="10" rx="4" ry="2" stroke={accent}/></>,
    stencil:<><path d="M10 7h21l9 9v26H10ZM31 7v10h9M6 12v34h29"/><path d="M18 32c-5-7 4-11 6-5 2-6 11-2 6 5l-6 5Z" stroke={accent}/></>,
    transfer:<><path d="M15 20h18v22H15zM18 20v-7h12v7M22 13V4h4v9"/><path d="M24 26c-6 7-6 12 0 12s6-5 0-12Z" stroke={accent}/></>,
    tape:<><ellipse cx="20" cy="21" rx="15" ry="16"/><ellipse cx="20" cy="21" rx="7" ry="9" stroke={accent}/><path d="M33 29 43 40H20"/></>,
    film:<><ellipse cx="15" cy="8" rx="8" ry="4"/><path d="M7 8v31c0 6 16 6 16 0V8M23 13l18 3v26l-18-3"/><path d="M15 12v25" stroke={accent}/></>,
    razor:<><path d="M7 6h34v12H7zM10 18l10 8v17h8V26l10-8"/><path d="M11 10h26M11 14h26M23 30h2m-2 5h2" stroke={accent}/></>,
    mask:<><path d="M10 14q14-7 28 0v17q-14 14-28 0ZM10 17C0 12 0 35 10 30M38 17c10-5 10 18 0 13"/><path d="M15 19h18M15 24h18M17 29h14" stroke={accent}/></>,
    gauze:<><path d="M9 8h30v32H9zM5 12v32h30"/><path d="M15 15h18M15 22h18M15 29h18M18 12v21M25 12v21M32 12v21" stroke={accent}/></>,
    apron:<><path d="M16 6h16v12l9 7-4 19H11L7 25l9-7ZM16 6q8 16 16 0"/><path d="M17 27h14v9H17z" stroke={accent}/></>,
    bag:<><path d="M16 5q8 6 16 0l-3 9c12 10 14 25 6 29H13c-8-4-6-19 6-29Z"/><path d="M17 15h14M24 23v13" stroke={accent}/></>,
    sharps:<><path d="M11 16h26l-3 27H14ZM8 10h32v6H8zM18 5h12v5"/><path d="M18 23l12 12M30 23 18 35" stroke={accent}/></>,
    machine:<><path d="m15 30-7 11 10-8 21-23-9-8-20 23ZM19 20l10 9M15 24l10 9"/><path d="m22 11 10 9 5-5-10-9Z" stroke={accent}/></>,
    power:<><rect x="5" y="9" width="38" height="30" rx="4"/><path d="M10 15h18v10H10zM9 39v4m29-4v4"/><circle cx="34" cy="28" r="5" stroke={accent}/><path d="M12 32h3m5 0h3M34 21v7" stroke={accent}/></>,
    cable:<><circle cx="24" cy="23" r="16"/><circle cx="24" cy="23" r="12"/><circle cx="24" cy="23" r="8"/><path d="M8 23v17m32-17v17M5 39h6v6H5zM37 39h6v6h-6z" stroke={accent}/></>,
    pedal:<><path d="m6 30 11-15 25 5-10 18ZM6 30v8l26 6 10-16v-8"/><path d="m14 28 15 3m-12-7 15 3m-13-7 15 3M17 15V6q0-4 10-4" stroke={accent}/></>,
    marker:<><path d="m9 37 5-10 20-23 9 8-21 23-11 5-5 4Z"/><path d="m23 17 9 8M24 13l9 8 6-8-7-6Z" stroke={accent}/></>,
    armrest:<><path d="m7 14 10-9 24 10-9 10ZM7 14v7l25 10 9-10v-6M22 28v13m5-11v11M14 44h22"/><path d="m10 14 21 9" stroke={accent}/></>,
    pipette:<><path d="m8 38 5-10 18-18 7 7-18 18-10 5-5 4Z"/><path d="m28 11 6-7q3-2 7 2t2 7l-6 7Z" stroke={accent}/></>,
    needle:<><path d="M10 42 35 7q4-4 6 0L13 43Z"/><path d="m33 13 5 3" stroke={accent}/></>,
    other:<><path d="m6 14 18-8 18 8v24l-18 8-18-8ZM6 14l18 8 18-8M24 22v24"/><path d="m15 10 18 8v10" stroke={accent}/></>,
  };
  const cartridge=<g transform="rotate(40 24 24)"><path d="M20 4h8v7h4v21l-5 9-3 4-3-4-5-9V11h4Z"/><path d="M20 4h8v7h-8ZM16 16h16M20 21h8v9h-8Z" stroke={accent}/>{symbol==="magnum"?<path d="M20 33v7m4-7v9m4-9v7"/>:<path d="M24 33v10"/>}</g>;
  const spray=<><path d="M15 22h18l3 8v13H12V30ZM20 12v10m9-10v10M10 5h24l7 7h-9l-4 5h-8l-3-5h-7Z"/><path d="M18 28h12v11H18zM14 12l-5 8" stroke={accent}/></>;
  return <svg className="session-material-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{["liner","magnum","shader"].includes(symbol)?cartridge:symbol==="soap"||symbol==="spray"?spray:paths[symbol]??paths.other}</svg>;
}
