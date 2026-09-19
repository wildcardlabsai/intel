"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import RegisterButton from "@/components/RegisterButton";

const NAV_LINKS = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Data", href: "#data" },
  { label: "Sectors", href: "#audience" },
  { label: "Insights", href: "#insights" },
  { label: "Contact", href: "#contact" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-6 py-6 sm:px-10">
        <a href="#home" className="text-cream">
          <span className="block text-xl font-extrabold leading-[1.15] tracking-tight">
            Cymru
          </span>
          <span className="block text-xl font-extrabold leading-[1.15] tracking-tight">
            Intelligence
          </span>
          <span className="mt-1 block text-[11px] font-medium tracking-wide text-cream/75">
            A clearer view of a stronger Wales
          </span>
        </a>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-cream/90 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:block">
          <RegisterButton variant="cream" />
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="text-cream lg:hidden"
        >
          <Menu className="h-7 w-7" />
        </button>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-green-900 px-6 py-6 text-cream lg:hidden">
          <div className="flex items-center justify-between">
            <span className="text-lg font-extrabold">Cymru Intelligence</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-7 w-7" />
            </button>
          </div>
          <nav className="mt-12 flex flex-col gap-6">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="text-2xl font-semibold"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-auto">
            <RegisterButton
              variant="cream"
              className="w-full justify-center"
            />
          </div>
        </div>
      )}
    </header>
  );
}
