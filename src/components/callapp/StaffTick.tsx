'use client'

/**
 * Verified-style tick next to staff names:
 *  - blue tick  → full admins and the CALL Official account
 *  - yellow tick → team members
 * Regular users get no tick.
 */
export function StaffTick({
  role,
  isOfficial,
  size = 15,
}: {
  role?: string | null
  isOfficial?: boolean
  size?: number
}) {
  const staff = isOfficial || role === 'admin' || role === 'team' || role === 'official'
  if (!staff) return null
  const isYellow = !isOfficial && role === 'team'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className="flex-none"
      role="img"
      aria-label={isYellow ? 'CALL team member' : 'Verified CALL staff'}
    >
      <path
        fill={isYellow ? '#F5A524' : '#2F5BE0'}
        d="M12 1.5l2.7 2.06 3.38-.3.9 3.27 2.9 1.77-1.3 3.17 1.3 3.17-2.9 1.77-.9 3.27-3.38-.3L12 22.5l-2.7-2.06-3.38.3-.9-3.27-2.9-1.77 1.3-3.17-1.3-3.17 2.9-1.77.9-3.27 3.38.3L12 1.5z"
      />
      <path
        d="M8.3 12.2l2.5 2.5 4.9-5.1"
        fill="none"
        stroke="#fff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Inline helper: name + tick on one line, truncation-safe. */
export function NameWithTick({
  name,
  role,
  isOfficial,
  className = 'text-[16px] font-bold text-cink',
  tickSize = 15,
}: {
  name: string
  role?: string | null
  isOfficial?: boolean
  className?: string
  tickSize?: number
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className={`truncate ${className}`}>{name}</span>
      <StaffTick role={role} isOfficial={isOfficial} size={tickSize} />
    </span>
  )
}
