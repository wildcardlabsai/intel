import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="border-b border-border bg-green-900 px-6 py-5 text-white lg:px-12">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="flex flex-col">
            <span className="text-lg font-bold leading-none tracking-tight">Cymru</span>
            <span className="text-lg font-bold leading-none tracking-tight">Intelligence</span>
          </Link>
          <Link href="/" className="text-sm font-medium text-emerald-100/80 transition-colors hover:text-white">
            Back to site
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 py-12 lg:py-20">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted">
        A clearer view of a stronger Wales · Built for Wales. Powered by data. Driven by people.
      </footer>
    </div>
  );
}
