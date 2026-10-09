/**
 * Click to Chat: abre o WhatsApp do visitante com a mensagem preenchida.
 * NÃO envia nada a partir do servidor e não confirma que uma conversa começou.
 * https://wa.me/<número internacional só com algarismos>?text=<mensagem codificada>
 */
export function waMeUrl(phoneE164: string, message: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function vehicleContactMessage(v: { make: string; model: string; reference: string }, url: string): string {
  return `Olá, tenho interesse na viatura ${v.make} ${v.model}, referência ${v.reference}. Está disponível? ${url}`;
}
