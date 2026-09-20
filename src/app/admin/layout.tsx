import Link from "next/link";

import { requireAdmin } from "@/lib/auth/session";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/sources", label: "Sources" },
  { href: "/admin/planning", label: "Planning authorities" },
  { href: "/admin/imports", label: "Import runs" },
  { href: "/admin/errors", label: "Errors" },
  { href: "/admin/quality", label: "Data quality" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/insights", label: "Insights" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-border bg-green-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <Link href="/admin" className="text-lg font-bold leading-none tracking-tight">
              Cymru Intelligence — Admin
            </Link>
            <p className="mt-1 text-xs text-emerald-100/60">
              Signed in as {user.email} ({user.role.toLowerCase().replace("_", " ")})
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-emerald-100/80 transition-colors hover:text-white"
          >
            Back to dashboard
          </Link>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-emerald-100/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-8">{children}</main>
    </div>
  );
}
