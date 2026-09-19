const FOOTER_LINKS = [
  { label: "About", href: "#about" },
  { label: "Data", href: "#data" },
  { label: "Insights", href: "#insights" },
  { label: "Contact", href: "#contact" },
];

export default function Footer() {
  return (
    <footer id="contact" className="bg-green-900 py-14 text-cream">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10 px-6 sm:px-10 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-lg font-extrabold leading-tight">Cymru</p>
          <p className="text-lg font-extrabold leading-tight">Intelligence</p>
          <p className="mt-2 text-sm text-cream/70">
            A clearer view of a stronger Wales
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-8 gap-y-3">
          {FOOTER_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-cream/85 transition-colors hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-start gap-4">
          <a
            href="https://linkedin.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Cymru Intelligence on LinkedIn"
            className="text-cream/85 transition-colors hover:text-white"
          >
            <LinkedinIcon className="h-5 w-5" />
          </a>
          <a
            href="https://x.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Cymru Intelligence on X"
            className="text-cream/85 transition-colors hover:text-white"
          >
            <XIcon className="h-5 w-5" />
          </a>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-[1400px] border-t border-cream/15 px-6 pt-6 sm:px-10">
        <p className="text-xs text-cream/60">
          Built for Wales. Powered by data. Driven by people.
        </p>
      </div>
    </footer>
  );
}

function LinkedinIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5.001 2.5 2.5 0 0 1 0-5.001ZM3 9.5h4v11H3v-11Zm7 0h3.83v1.5h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.77 2.5 4.77 5.75v5.7h-4v-5.05c0-1.2-.02-2.75-1.7-2.75-1.7 0-1.96 1.3-1.96 2.66v5.14h-4v-11Z" />
    </svg>
  );
}

function XIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.828l-5.35-6.99L4.7 22H1.44l8.02-9.17L1 2h6.99l4.84 6.4L18.244 2Zm-1.2 18.17h1.8L7.02 3.73H5.09l11.955 16.44Z" />
    </svg>
  );
}
