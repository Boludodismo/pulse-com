export function emailAvailable() {
  return Boolean(process.env.AUTH_EMAIL_API_KEY && process.env.AUTH_EMAIL_FROM);
}
export async function sendSecurityEmail(
  to: string,
  subject: string,
  text: string
) {
  if (!emailAvailable())
    throw new Error("Envio de e-mail de segurança ainda não configurado.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${process.env.AUTH_EMAIL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM,
      to: [to],
      subject,
      text,
    }),
  });
  if (!response.ok)
    throw new Error("Não foi possível enviar o e-mail de segurança.");
}
