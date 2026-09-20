import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="bg-green-900 px-6 py-5 text-white lg:px-12">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="flex flex-col">
            <span className="text-lg font-bold leading-none tracking-tight">Cymru</span>
            <span className="text-lg font-bold leading-none tracking-tight">Intelligence</span>
          </Link>
          <Link href="/" className="text-sm font-medium text-emerald-100/80 hover:text-white">
            Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <article className="space-y-6 text-sm leading-relaxed text-muted [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink-900 [&_h3]:mt-6 [&_h3]:font-bold [&_h3]:text-ink-900 [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink-900">
          {children}
        </article>
      </main>

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
