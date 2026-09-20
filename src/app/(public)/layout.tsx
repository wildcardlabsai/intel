import Link from "next/link";

/**
 * Public, unauthenticated pages that are not the landing page.
 *
 * Deliberately plain: it carries the brand but not the marketing site's
 * chrome, so a linked insight reads as a document rather than a pitch.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="bg-green-900 px-6 py-5 text-white lg:px-12">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex flex-col">
            <span className="text-lg font-bold leading-none tracking-tight">Cymru</span>
            <span className="text-lg font-bold leading-none tracking-tight">Intelligence</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium text-emerald-100/80">
            <Link href="/insights" className="hover:text-white">
              Insights
            </Link>
            <Link href="/" className="hover:text-white">
              Back to site
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">{children}</main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted">
        <Link href="/terms" className="hover:text-ink-900">
          Terms
        </Link>
        {" · "}
        <Link href="/privacy" className="hover:text-ink-900">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
