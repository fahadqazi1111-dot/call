'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { api } from '@/lib/callapp/api'
import { useApp } from '@/lib/callapp/store'
import { Avatar } from './Avatar'
import type { StoryGroup } from '@/lib/callapp/types'
import { StoryViewer } from './StoryViewer'

/**
 * WhatsApp-style stories tray shown at the top of the chats list.
 * "My status" + friend story rings with unseen gradient.
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
  const myHasStory = !!mine && mine.stories.length > 0

  return (
    <div
      className={`stories-scroll no-scrollbar flex gap-4 overflow-x-auto pb-1.5 pt-1 px-4 ${
        compact ? 'pt-2' : ''
      }`}
    >
      {/* my status */}
      <button
        className="group relative flex flex-none flex-col items-center gap-1.5"
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
              className={`rounded-full p-[3px] ${
                mine!.allSeen ? 'bg-[#C9D2E4]' : 'bg-gradient-to-tr from-[#2F5BE0] via-[#7B3FE4] to-[#E1306C]'
              }`}
            >
              <Avatar name={me?.name ?? 'Me'} avatarKey={me?.avatarKey ?? 0} size={compact ? 50 : 58} src={me?.avatarUrl} className="ring-2 ring-white rounded-full" />
            </span>
          ) : (
            <span className="rounded-full p-[3px] ring-[1.5px] ring-[#C9D2E4]">
              <Avatar name={me?.name ?? 'Me'} avatarKey={me?.avatarKey ?? 0} size={compact ? 50 : 58} src={me?.avatarUrl} />
            </span>
          )}
          <span
            className={`absolute -bottom-0.5 -right-0.5 flex h-[24px] w-[24px] items-center justify-center rounded-full text-white ring-[3px] ring-white transition group-hover:scale-105 ${
              myHasStory ? 'bg-cink/80' : 'bg-cbrand'
            }`}
          >
            <Plus size={15} strokeWidth={2.6} />
          </span>
        </span>
        <span className="max-w-[66px] truncate text-[11px] font-semibold leading-4 text-cink">My status</span>
      </button>

      {/* friends */}
      {others.map((g) => (
        <button
          key={g.userId}
          className="group flex flex-none flex-col items-center gap-1.5"
          onClick={() => {
            const idx = groups.findIndex((x) => x.userId === g.userId)
            setViewing({ groups, start: idx })
          }}
          aria-label={`${g.name}'s story`}
        >
          <span
            className={`rounded-full p-[3px] transition group-hover:scale-[1.04] ${
              g.allSeen ? 'bg-[#C9D2E4]' : 'bg-gradient-to-tr from-[#2F5BE0] via-[#7B3FE4] to-[#E1306C]'
            }`}
          >
            <Avatar name={g.name} avatarKey={g.avatarKey} size={compact ? 50 : 58} src={g.avatarUrl} className="rounded-full ring-2 ring-white" />
          </span>
          <span className="max-w-[66px] truncate text-[11px] font-semibold leading-4 text-cink">{g.name.split(' ')[0]}</span>
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
