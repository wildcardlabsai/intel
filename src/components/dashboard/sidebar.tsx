"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  Bookmark,
  Building2,
  Coins,
  Construction,
  Download,
  FileText,
  KeyRound,
  LayoutDashboard,
  Map,
  MapPin,
  Menu,
  Settings,
  Shield,
  Users,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_SECTIONS: Array<{
  label: string;
  items: Array<{ href: string; label: string; icon: typeof LayoutDashboard }>;
}> = [
  {
    label: "Intelligence",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/companies", label: "Company search", icon: Building2 },
      { href: "/dashboard/planning", label: "Planning", icon: MapPin },
      { href: "/dashboard/procurement", label: "Procurement", icon: FileText },
      { href: "/dashboard/funding", label: "Funding", icon: Coins },
      { href: "/dashboard/jobs", label: "Jobs", icon: Users },
      { href: "/dashboard/infrastructure", label: "Infrastructure", icon: Construction },
      { href: "/dashboard/map", label: "Map", icon: Map },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/dashboard/saved", label: "Saved items", icon: Bookmark },
      { href: "/dashboard/alerts", label: "Alerts", icon: Bell },
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
      { href: "/dashboard/exports", label: "Export data", icon: Download },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/team", label: "Team", icon: Users },
      { href: "/dashboard/api", label: "API access", icon: KeyRound },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function DashboardSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-100/40">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-white/10 text-white"
                        : "text-emerald-100/75 hover:bg-white/5 hover:text-white"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {isAdmin && (
        <div>
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-100/40">
            Administration
          </p>
          <Link
            href="/admin"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-white/10 text-white"
                : "text-emerald-100/75 hover:bg-white/5 hover:text-white"
            )}
          >
            <Shield className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Admin
          </Link>
        </div>
      )}
    </nav>
  );

  return (
    <>
      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-border bg-green-900 px-4 py-3 text-white lg:hidden">
        <Link href="/dashboard" className="flex flex-col">
          <span className="text-sm font-bold leading-none">Cymru</span>
          <span className="text-sm font-bold leading-none">Intelligence</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          className="rounded-md p-2 text-white"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="flex flex-col border-b border-white/10 bg-green-900 lg:hidden">{nav}</div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-green-900 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <Link href="/dashboard" className="block px-6 py-5 text-white">
          <span className="block text-lg font-bold leading-none tracking-tight">Cymru</span>
          <span className="block text-lg font-bold leading-none tracking-tight">Intelligence</span>
          <span className="mt-1 block text-[10px] text-emerald-100/60">
            A clearer view of a stronger Wales
          </span>
        </Link>
        {nav}
      </aside>
    </>
  );
}
