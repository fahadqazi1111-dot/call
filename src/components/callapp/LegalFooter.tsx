'use client'

import Link from 'next/link'

/**
 * Legal Footer — shows all legal links at the bottom of auth pages.
 * Used on login/signup screens so users can access policies before signing up.
 *
 * Each link opens the legal page in the same tab (so back button works).
 */
export function LegalFooter() {
  return (
    <footer className="mt-8 border-t border-cline pt-5">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11.5px] text-cmut">
        <Link href="/legal/terms" className="transition-colors hover:text-cbrand">
          Terms
        </Link>
        <span className="text-cline">·</span>
        <Link href="/legal/privacy" className="transition-colors hover:text-cbrand">
          Privacy
        </Link>
        <span className="text-cline">·</span>
        <Link href="/legal/cookies" className="transition-colors hover:text-cbrand">
          Cookies
        </Link>
        <span className="text-cline">·</span>
        <Link href="/legal/community" className="transition-colors hover:text-cbrand">
          Community
        </Link>
        <span className="text-cline">·</span>
        <Link href="/legal/deletion" className="transition-colors hover:text-cbrand">
          Account Deletion
        </Link>
        <span className="text-cline">·</span>
        <Link href="/legal/contact" className="transition-colors hover:text-cbrand">
          Support
        </Link>
      </div>
      <p className="mt-3 text-center text-[11px] text-cmut/70">
        © {new Date().getFullYear()} CALL · One World. One Call.
      </p>
    </footer>
  )
}
