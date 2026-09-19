import "server-only";

import { Resend } from "resend";

import { getEnv, isConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Transactional email via Resend.
 *
 * When RESEND_API_KEY is absent, `sendEmail` returns `{ sent: false,
 * reason }` rather than throwing or pretending to have sent. Callers surface
 * that honestly; nothing in the product claims an email went out when it did
 * not.
 */

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!isConfigured("resend")) return null;
  const env = getEnv();
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

export type SendResult = { sent: true; id: string } | { sent: false; reason: string };

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<SendResult> {
  const resend = getClient();
  if (!resend) {
    return {
      sent: false,
      reason: "RESEND_API_KEY is not set, so no email was sent.",
    };
  }

  const env = getEnv();

  try {
    const { data, error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    });

    if (error || !data) {
      logger.warn("email send failed", { message: error?.message, to: redactEmail(params.to) });
      return { sent: false, reason: error?.message ?? "Unknown Resend error" };
    }

    return { sent: true, id: data.id };
  } catch (error) {
    logger.error("email send threw", error, { to: redactEmail(params.to) });
    return { sent: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Shared shell so every email looks like the product. */
export function renderEmail(params: {
  heading: string;
  intro: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}): { html: string; text: string } {
  const { heading, intro, body, ctaLabel, ctaUrl, footerNote } = params;

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#F4F3EC;font-family:'Helvetica Neue',Arial,sans-serif;color:#10221E;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;">
      <tr><td style="padding-bottom:20px;">
        <span style="display:block;font-size:18px;font-weight:700;line-height:1.2;">Cymru</span>
        <span style="display:block;font-size:18px;font-weight:700;line-height:1.2;">Intelligence</span>
      </td></tr>
      <tr><td style="background:#FCFBF7;border:1px solid #D9DDD5;border-radius:12px;padding:28px;">
        <h1 style="margin:0 0 12px;font-size:20px;">${escapeHtml(heading)}</h1>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#66736D;">${escapeHtml(intro)}</p>
        <div style="font-size:14px;line-height:1.6;">${body}</div>
        ${
          ctaLabel && ctaUrl
            ? `<p style="margin:24px 0 0;"><a href="${ctaUrl}" style="display:inline-block;background:#102A23;color:#F4F3EC;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:600;font-size:14px;">${escapeHtml(ctaLabel)}</a></p>`
            : ""
        }
      </td></tr>
      <tr><td style="padding-top:20px;font-size:12px;color:#66736D;line-height:1.6;">
        ${footerNote ? `${escapeHtml(footerNote)}<br>` : ""}
        Cymru Intelligence is an independent service built on public data.
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    heading,
    "",
    intro,
    "",
    body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    ctaUrl ? `\n${ctaLabel}: ${ctaUrl}` : "",
    footerNote ? `\n${footerNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
