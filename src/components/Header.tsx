"use client";

import { useState } from "react";
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
    <header className="absolute inset-x-0 top-0 z-40 px-6 pb-6 pt-6 text-white lg:px-12">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <a href="#home" className="group flex flex-col focus:outline-none">
          <span className="text-xl font-bold leading-none tracking-tight text-white group-hover:opacity-90 md:text-2xl">
            Cymru
          </span>
          <span className="text-xl font-bold leading-none tracking-tight text-white group-hover:opacity-90 md:text-2xl">
            Intelligence
          </span>
          <span className="mt-1 text-[11px] font-normal tracking-wide text-emerald-100/70 md:text-xs">
            A clearer view of a stronger Wales
          </span>
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium text-white/90 md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="transition-colors hover:text-white">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <RegisterButton
            variant="dark"
            className="hidden rounded-md px-5 py-2.5 text-sm sm:inline-flex"
            showArrow={false}
          />

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
            className="rounded-md p-2 text-white focus:outline-none md:hidden"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="absolute inset-x-0 top-full space-y-4 border-b border-white/10 bg-green-900/95 px-6 py-6 shadow-xl backdrop-blur-md md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block font-medium text-white/90 hover:text-white"
            >
              {link.label}
            </a>
          ))}
          <div onClick={() => setMenuOpen(false)}>
            <RegisterButton
              variant="cream"
              className="w-full justify-center rounded-md py-3 text-sm"
              showArrow={false}
            />
          </div>
        </div>
      )}
    </header>
  );
}
