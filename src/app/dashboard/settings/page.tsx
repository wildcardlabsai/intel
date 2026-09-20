import type { Metadata } from "next";

import { AccountSettingsForm, DangerZone, DataExport } from "@/app/dashboard/settings/settings-ui";
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth/session";
import { getEntitlements } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings | Cymru Intelligence" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");

  const [record, entitlements] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        jobTitle: true,
        email: true,
        createdAt: true,
        emailAlerts: true,
        emailDigest: true,
        emailProduct: true,
      },
    }),
    getEntitlements(user),
  ]);

  if (!record) return null;

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Your profile, email preferences and data."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <AccountSettingsForm
            initial={{
              name: record.name ?? "",
              jobTitle: record.jobTitle ?? "",
              emailAlerts: record.emailAlerts,
              emailDigest: record.emailDigest,
              emailProduct: record.emailProduct,
            }}
          />

          <DataExport />
          <DangerZone />
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Email" value={record.email} />
            <Row label="Plan" value={entitlements.planName} />
            <Row label="Member since" value={formatDate(record.createdAt)} />
            <Row
              label="Organisation"
              value={user.organisationName ?? "Personal account"}
            />
            <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted">
              To change your email address or password, use the password reset flow from the sign-in
              page. Credentials are managed by Supabase Auth and are never stored by this
              application.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="truncate text-right font-medium text-ink-900">{value}</span>
    </div>
  );
}
