import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { Badge } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { getEntitlements } from "@/lib/billing/plans";
import { isAdmin, requireUser } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const entitlements = await getEntitlements(user);

  return (
    <div className="flex min-h-screen flex-col bg-cream lg:flex-row">
      <DashboardSidebar isAdmin={isAdmin(user)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-cream/95 px-6 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">
              {user.name ?? user.email}
            </p>
            <p className="truncate text-xs text-muted">
              {user.organisationName ?? "Personal account"}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <Link href="/dashboard/billing">
              <Badge tone={entitlements.planCode === "FREE" ? "neutral" : "info"}>
                {entitlements.planName} plan
              </Badge>
            </Link>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </header>

        <main className="flex-1 px-6 py-8">
          <div className="mx-auto max-w-7xl space-y-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
