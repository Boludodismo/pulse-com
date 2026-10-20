/** The share target is chosen by the visitor in WhatsApp, never by the CRM. */
export function artistCardShareMessage(name: string, profileUrl: string) {
  return `Arte boa merece ser compartilhada! 🎨\n\nConheça o trabalho de ${name.trim()} pelo cartão de apresentação:\n${profileUrl}`;
}

export function artistCardWhatsAppShareUrl(name: string, profileUrl: string) {
  return `https://wa.me/?text=${encodeURIComponent(artistCardShareMessage(name, profileUrl))}`;
}
