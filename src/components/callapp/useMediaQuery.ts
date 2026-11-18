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
