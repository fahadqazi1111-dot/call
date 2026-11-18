'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { COUNTRIES, flagOf, type Country } from '@/lib/callapp/countries'

/**
 * Country dial-code picker: trigger shows flag + dial code; the popover
 * lists every country with its flag and supports search by name or code.
 */
export function CountryPicker({
  value,
  onChange,
}: {
  /** dial code, e.g. "+92" */
  value: string
  onChange: (dial: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(
    () => COUNTRIES.find((c) => c.dial === value) ?? COUNTRIES[COUNTRIES.length - 1],
    [value]
  )

  const list = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, '')
    if (!q) return COUNTRIES
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.dial.replace('+', '').startsWith(q)
    )
  }, [query])

  // close on outside click / Escape, focus search when opened
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => searchRef.current?.focus(), 30)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [open])

  return (
    <div className="relative flex-none" ref={rootRef}>
      <button
        type="button"
        className="app-input flex w-[118px] items-center justify-between gap-1 px-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Country code"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-[19px] leading-none">{flagOf(selected.code)}</span>
          <span className="truncate text-[14.5px] font-semibold">{selected.dial}</span>
        </span>
        <ChevronDown size={15} className={`flex-none text-cmut transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-[62px] z-40 w-[290px] overflow-hidden rounded-[18px] border border-cline bg-white shadow-[0_24px_60px_-18px_rgba(14,23,38,0.35)]">
          <div className="border-b border-cline p-2.5">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cmut" />
              <input
                ref={searchRef}
                className="h-10 w-full rounded-[12px] bg-cbg pl-9 pr-3 text-[14px] font-medium outline-none placeholder:text-[#8a94a8]"
                placeholder="Search country or code"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="app-scroll max-h-[264px] overflow-y-auto p-1.5" role="listbox">
            {list.length === 0 && (
              <p className="px-3 py-6 text-center text-[13px] text-cmut">No country found</p>
            )}
            {list.map((c) => (
              <button
                key={c.code}
                type="button"
                role="option"
                aria-selected={c.dial === value}
                className={`flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left transition hover:bg-cbg ${
                  c.dial === value ? 'bg-csoft' : ''
                }`}
                onClick={() => {
                  onChange(c.dial)
                  setOpen(false)
                  setQuery('')
                }}
              >
                <span className="w-7 flex-none text-center text-[19px] leading-none">{flagOf(c.code)}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-cink">{c.name}</span>
                <span className="flex-none text-[12.5px] font-bold text-cmut">{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
