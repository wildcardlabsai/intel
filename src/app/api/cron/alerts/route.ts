import { NextResponse } from "next/server";

import { authoriseCronRequest } from "@/lib/api/cron-auth";
import { prisma } from "@/lib/db/prisma";
import { renderEmail, sendEmail, escapeHtml } from "@/lib/email/resend";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getDueAlerts, processAlert } from "@/lib/services/alerts";

/**
 * Processes every alert that is due, then emails the users whose alerts
 * matched and who have email notifications enabled.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const unauthorised = authoriseCronRequest(request);
  if (unauthorised) return unauthorised;

  const env = getEnv();
  const alerts = await getDueAlerts(200);

  let processed = 0;
  let totalMatches = 0;
  let emailsSent = 0;
  let emailsSkipped = 0;

  for (const alert of alerts) {
    try {
      const result = await processAlert(alert);
      processed += 1;
      totalMatches += result.matches;

      if (!result.notified || !alert.emailEnabled) continue;

      const user = await prisma.user.findUnique({
        where: { id: alert.userId },
        select: { email: true, name: true, emailAlerts: true, deletedAt: true },
      });

      if (!user || user.deletedAt || !user.emailAlerts) continue;

      const events = await prisma.alertEvent.findMany({
        where: { alertId: alert.id, notifiedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      if (events.length === 0) continue;

      const body = `<ul style="margin:0;padding-left:18px;">${events
        .map(
          (event) =>
            `<li style="margin-bottom:8px;"><a href="${env.APP_URL}${event.url ?? "/dashboard"}" style="color:#326052;">${escapeHtml(
              event.title
            )}</a>${event.summary ? `<br><span style="color:#66736D;">${escapeHtml(event.summary)}</span>` : ""}</li>`
        )
        .join("")}</ul>`;

      const { html, text } = renderEmail({
        heading: `${events.length} new ${events.length === 1 ? "match" : "matches"} for “${alert.name}”`,
        intro: "New records matching your saved alert have been added to Cymru Intelligence.",
        body,
        ctaLabel: "View in dashboard",
        ctaUrl: `${env.APP_URL}/dashboard/alerts/${alert.id}`,
        footerNote: "Manage or pause this alert from your dashboard.",
      });

      const result2 = await sendEmail({
        to: user.email,
        subject: `Cymru Intelligence — ${events.length} new ${events.length === 1 ? "match" : "matches"}`,
        html,
        text,
      });

      if (result2.sent) {
        emailsSent += 1;
        await prisma.alertEvent.updateMany({
          where: { id: { in: events.map((event) => event.id) } },
          data: { notifiedAt: new Date() },
        });
      } else {
        // Events stay un-notified so the next run retries them rather than
        // silently dropping the notification.
        emailsSkipped += 1;
        logger.warn("alert email not sent", { alertId: alert.id, reason: result2.reason });
      }
    } catch (error) {
      logger.error("alert processing failed", error, { alertId: alert.id });
    }
  }

  return NextResponse.json({
    status: "ok",
    due: alerts.length,
    processed,
    totalMatches,
    emailsSent,
    emailsSkipped,
  });
}

export async function GET(request: Request) {
  return POST(request);
}
