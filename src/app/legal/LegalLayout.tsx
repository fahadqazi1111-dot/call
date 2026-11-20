import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  ShieldCheck,
  FileText,
  Users,
  Cookie,
  UserX,
  Mail,
} from 'lucide-react'

export type TocItem = { id: string; label: string }

const NAV_LINKS = [
  { href: '/legal/privacy', label: 'Privacy Policy', icon: ShieldCheck },
  { href: '/legal/terms', label: 'Terms', icon: FileText },
  { href: '/legal/community', label: 'Community', icon: Users },
  { href: '/legal/cookies', label: 'Cookies', icon: Cookie },
  { href: '/legal/deletion', label: 'Deletion', icon: UserX },
  { href: '/legal/contact', label: 'Contact', icon: Mail },
] as const

/**
 * Shared layout for every legal/privacy page under /legal/*.
 * Server component — no interactivity required.
 *
 * - Sticky top header with back-to-home link + cross-page nav.
 * - Sticky left-side TOC (desktop only; mobile gets a <details> accordion
 *   that doesn't need any JS to toggle, since <details> works natively).
 * - max-w-3xl prose-styled article container.
 * - Footer pinned to viewport bottom via flex-col + mt-auto.
 */
export function LegalLayout({
  title,
  intro,
  updated = 'November 2026',
  toc = [],
  children,
}: {
  title: string
  intro?: string
  updated?: string
  toc?: TocItem[]
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cbg">
      {/* ============== Sticky header ============== */}
      <header className="sticky top-0 z-30 border-b border-cline bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-cink transition-colors hover:text-cbrand"
          >
            <ArrowLeft size={18} className="text-cbrand" />
            <span className="tracking-tight">CALL</span>
          </Link>

          <nav
            aria-label="Legal pages"
            className="hidden items-center gap-1 md:flex"
          >
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-cmut transition-colors hover:bg-csoft hover:text-cink"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* ============== Body ============== */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
          {/* ----- Sidebar TOC (desktop sticky) + mobile dropdown ----- */}
          {toc.length > 0 && (
            <aside className="lg:block">
              {/* Desktop sticky TOC */}
              <div className="hidden lg:block">
                <div className="sticky top-20">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-cmut">
                    On this page
                  </p>
                  <ul className="space-y-1.5 border-l border-cline">
                    {toc.map((item) => (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          className="-ml-px block border-l-2 border-transparent py-0.5 pl-3 text-[13px] leading-snug text-cmut transition-colors hover:border-cbrand hover:text-cbrand"
                        >
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Mobile TOC: native <details> — no client JS needed */}
              <details className="group rounded-xl border border-cline bg-white p-3 lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-semibold text-cink">
                  <span>On this page</span>
                  <span className="text-cmut transition-transform group-open:rotate-90">
                    ›
                  </span>
                </summary>
                <ul className="mt-3 space-y-1.5">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="block py-0.5 text-[13px] leading-snug text-cmut hover:text-cbrand"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            </aside>
          )}

          {/* ----- Article body ----- */}
          <article className="min-w-0 max-w-3xl">
            <header className="mb-8 border-b border-cline pb-6">
              <p className="mb-2 text-[12px] font-medium uppercase tracking-wider text-cmut">
                Last updated: {updated}
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-cink sm:text-4xl">
                {title}
              </h1>
              {intro && (
                <p className="mt-3 text-[15px] leading-relaxed text-cmut">
                  {intro}
                </p>
              )}
            </header>

            <div className="space-y-10">{children}</div>
          </article>
        </div>
      </main>

      {/* ============== Footer (pinned to bottom) ============== */}
      <footer className="mt-auto border-t border-cline bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p className="text-[12px] text-cmut">
            © 2026 CALL — Calls &amp; chats without borders.
          </p>
          <nav
            aria-label="Legal footer"
            className="flex flex-wrap gap-x-4 gap-y-1.5"
          >
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-cmut transition-colors hover:text-cbrand"
              >
                <l.icon size={12} className="opacity-70" />
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Small presentational helpers used by every legal page so the
 * section markup stays uniform and the prose reads like a real doc.
 * ------------------------------------------------------------------ */

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <h2
        id={`${id}-title`}
        className="mb-3 text-xl font-semibold tracking-tight text-cink"
      >
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-cink">
        {children}
      </div>
    </section>
  )
}

/**
 * Bullet list for legal pages. Use one `<LegalItem>` per bullet.
 * Children are rendered inside an unstyled wrapper so callers can pass
 * arbitrary inline JSX (bold labels, links, etc.) without worrying about
 * React `key` warnings.
 */
export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="ml-1 space-y-2">{children}</ul>
}

export function LegalItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5 leading-relaxed">
      <span
        aria-hidden
        className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-cbrand"
      />
      <span className="text-[15px] text-cink">{children}</span>
    </li>
  )
}

/**
 * Inline highlight box used to flag key info (e.g. how to delete account).
 */
export function LegalCallout({
  title,
  children,
}: {
  title?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-cline bg-csoft p-4 sm:p-5">
      {title && (
        <p className="mb-1 text-[13.5px] font-semibold text-cbrand">{title}</p>
      )}
      <div className="text-[14.5px] leading-relaxed text-cink">{children}</div>
    </div>
  )
}
