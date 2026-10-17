/**
 * Canaux sortants (email, SMS) derrière une interface unique.
 *  - log  : écrit le message dans les journaux (développement — aucun envoi réel) ;
 *  - http : POST JSON vers l'API d'un fournisseur (Brevo, Mailjet, Twilio, Orange SMS…)
 *           via un petit adaptateur ; URL et jeton configurés par variables d'environnement.
 */
import { env } from "../env";
import { logger } from "../logger";

export interface OutboundChannel {
  readonly name: string;
  send(msg: { to: string; subject?: string | null; body: string }): Promise<{ providerRef: string }>;
}

class LogChannel implements OutboundChannel {
  constructor(readonly name: string) {}
  async send(msg: { to: string; subject?: string | null; body: string }) {
    logger.info(`outbound.${this.name}`, { to: msg.to, subject: msg.subject, preview: msg.body.slice(0, 160) });
    return { providerRef: `log_${Date.now()}` };
  }
}

class HttpChannel implements OutboundChannel {
  constructor(readonly name: string, private readonly url: string, private readonly token: string | undefined, private readonly from?: string) {}
  async send(msg: { to: string; subject?: string | null; body: string }) {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(this.token ? { authorization: `Bearer ${this.token}` } : {}) },
      body: JSON.stringify({ from: this.from, to: msg.to, subject: msg.subject, text: msg.body }),
    });
    if (!res.ok) throw new Error(`${this.name} : réponse ${res.status}`);
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { providerRef: data.id ?? `http_${Date.now()}` };
  }
}

export function emailChannel(): OutboundChannel {
  const e = env();
  if (e.EMAIL_PROVIDER === "http" && e.EMAIL_HTTP_URL) return new HttpChannel("email", e.EMAIL_HTTP_URL, e.EMAIL_HTTP_TOKEN, e.EMAIL_FROM);
  return new LogChannel("email");
}

export function smsChannel(): OutboundChannel {
  const e = env();
  if (e.SMS_PROVIDER === "http" && e.SMS_HTTP_URL) return new HttpChannel("sms", e.SMS_HTTP_URL, e.SMS_HTTP_TOKEN);
  return new LogChannel("sms");
}
