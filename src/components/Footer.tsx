const FOOTER_LINKS = [
  { label: "About", href: "#about" },
  { label: "Data", href: "#data" },
  { label: "Insights", href: "#insights" },
  { label: "Contact", href: "#contact" },
];

export default function Footer() {
  return (
    <footer id="contact" className="border-t border-white/10 bg-green-900 px-6 py-16 text-white lg:px-12">
      <div className="mx-auto max-w-7xl space-y-12">
        <div className="grid grid-cols-1 items-start gap-8 md:grid-cols-12">
          <div className="space-y-2 md:col-span-5">
            <div className="flex flex-col">
              <span className="text-2xl font-bold leading-none tracking-tight text-white">Cymru</span>
              <span className="text-2xl font-bold leading-none tracking-tight text-white">Intelligence</span>
            </div>
            <p className="pt-2 text-sm font-normal text-emerald-100/70">
              A clearer view of a stronger Wales
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-sm font-medium text-emerald-100/80 md:col-span-4">
            {FOOTER_LINKS.map((link) => (
              <a key={link.label} href={link.href} className="transition-colors hover:text-white">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4 md:col-span-3 md:justify-end">
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Cymru Intelligence on LinkedIn"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:border-white hover:text-white"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
              </svg>
            </a>
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Cymru Intelligence on X"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:border-white hover:text-white"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-emerald-100/60 sm:flex-row">
          <div>&copy; 2026 Cymru Intelligence. Pre-launch platform preview.</div>
          <div className="font-normal text-emerald-100/80">
            Built for Wales. Powered by data. Driven by people.
          </div>
        </div>
      </div>
    </footer>
  );
}
