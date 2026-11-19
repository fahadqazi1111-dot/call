'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { Avatar } from './Avatar'
import type { StoryGroup } from '@/lib/callapp/types'
import { StoryViewer } from './StoryViewer'

/**
 * WhatsApp/Instagram-quality stories tray.
 *  - unseen: animated conic-gradient ring with a clean white gap
 *  - seen:   single soft grey ring (no heavy padding), avatar slightly dimmed
 *  - my status with no story: plain avatar + compact brand "+" badge
 */
export function StoriesTray({ variant = 'mobile' }: { variant?: 'mobile' | 'desktop' }) {
  const me = useApp((s) => s.me)
  const [groups, setGroups] = useState<StoryGroup[]>([])
  const [viewing, setViewing] = useState<{ groups: StoryGroup[]; start: number } | null>(null)
  const setOverlay = useApp((s) => s.setOverlay)

  const load = async () => {
    try {
      const res = await api.stories()
      setGroups(res.groups)
    } catch {}
  }

  useEffect(() => {
    queueMicrotask(() => void load())
    const t = window.setInterval(() => void load(), 30_000)
    const onRefresh = () => void load()
    window.addEventListener('call:stories-refresh', onRefresh)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('call:stories-refresh', onRefresh)
    }
  }, [])

  const mine = groups.find((g) => g.mine)
  const others = groups.filter((g) => !g.mine)
  const compact = variant === 'desktop'
  const size = compact ? 54 : 62
  const myHasStory = !!mine && mine.stories.length > 0

  return (
    <div
      className={`stories-scroll no-scrollbar flex flex-none gap-[18px] overflow-x-auto px-4 pb-2 pt-2 ${
        compact ? 'pt-3' : ''
      }`}
    >
      {/* my status */}
      <button
        className="group flex flex-none flex-col items-center gap-[7px]"
        onClick={() => {
          if (myHasStory) {
            setViewing({ groups: [mine!], start: 0 })
          } else {
            setOverlay('story-composer')
          }
        }}
        aria-label={myHasStory ? 'View my story' : 'Add to my story'}
      >
        <span className="relative inline-flex">
          {myHasStory ? (
            <span
              className="rounded-full transition-transform duration-200 group-hover:scale-[1.04]"
              style={{
                padding: 3.5,
                background: mine!.allSeen
                  ? 'conic-gradient(from 210deg, #c9d3ec, #e3e9f6, #c9d3ec)'
                  : 'conic-gradient(from 210deg, #2F5BE0, #7B3FE4, #E1306C, #F59E0B, #2F5BE0)',
              }}
            >
              <span className="block rounded-full bg-white p-[2.5px]">
                <Avatar
                  name={me?.name ?? 'Me'}
                  avatarKey={me?.avatarKey ?? 0}
                  size={size}
                  src={me?.avatarUrl}
                  className="rounded-full"
                />
              </span>
            </span>
          ) : (
            <>
              <Avatar
                name={me?.name ?? 'Me'}
                avatarKey={me?.avatarKey ?? 0}
                size={size}
                src={me?.avatarUrl}
                className="rounded-full ring-[2.5px] ring-[#D8DFEF]"
              />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-cbrand text-white ring-[3px] ring-white transition-transform group-hover:scale-110">
                <Plus size={13} strokeWidth={3} />
              </span>
            </>
          )}
        </span>
        <span className="max-w-[72px] truncate text-[11.5px] font-semibold leading-4 text-cink">My status</span>
      </button>

      {/* friends */}
      {others.map((g) => (
        <button
          key={g.userId}
          className="group flex flex-none flex-col items-center gap-[7px]"
          onClick={() => {
            const idx = groups.findIndex((x) => x.userId === g.userId)
            setViewing({ groups, start: idx })
          }}
          aria-label={`${g.name}'s story`}
        >
          {g.allSeen ? (
            <Avatar
              name={g.name}
              avatarKey={g.avatarKey}
              size={size}
              src={g.avatarUrl}
              className="rounded-full opacity-[0.72] ring-[2.5px] ring-[#D8DFEF] transition-all group-hover:opacity-100"
            />
          ) : (
            <span
              className="rounded-full transition-transform duration-200 group-hover:scale-[1.05]"
              style={{
                padding: 3.5,
                background: 'conic-gradient(from 210deg, #2F5BE0, #7B3FE4, #E1306C, #F59E0B, #2F5BE0)',
              }}
            >
              <span className="block rounded-full bg-white p-[2.5px]">
                <Avatar name={g.name} avatarKey={g.avatarKey} size={size} src={g.avatarUrl} className="rounded-full" />
              </span>
            </span>
          )}
          <span className="max-w-[72px] truncate text-[11.5px] font-semibold leading-4 text-cink">
            {g.name.split(' ')[0]}
          </span>
        </button>
      ))}

      {viewing && (
        <StoryViewer
          groups={viewing.groups}
          startGroup={viewing.start}
          onClose={() => {
            setViewing(null)
            void load()
          }}
        />
      )}
    </div>
  )
}
