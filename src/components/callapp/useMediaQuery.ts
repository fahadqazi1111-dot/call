'use client'

import { useEffect, useState } from 'react'

/** Reactive CSS media query hook (SSR-safe). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Tablet / desktop breakpoint: >= 768px gets the WhatsApp-Web style shell. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)')
}

/** Short viewports (< 700px tall): onboarding switches to a compact layout
 *  so every slide fits without vertical scrolling. */
export function useCompactHeight(): boolean {
  return useMediaQuery('(max-height: 699px)')
}

/** Extremely short viewports (< 500px tall, e.g. landscape phones):
 *  slide visuals are scaled down so everything still fits on one screen. */
export function useVeryShortHeight(): boolean {
  return useMediaQuery('(max-height: 499px)')
}
