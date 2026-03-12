import { useState, useRef, useEffect } from 'react'
import { LogOut, History, ChevronDown } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

interface UserMenuProps {
  user: User
  onSignOut: () => void
  onHistory: () => void
}

export function UserMenu({ user, onSignOut, onHistory }: UserMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initial = (user.email?.[0] || user.user_metadata?.name?.[0] || '?').toUpperCase()
  const displayName = user.user_metadata?.full_name || user.email || 'User'

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
      >
        <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold">
          {user.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              className="w-7 h-7 rounded-full"
            />
          ) : (
            initial
          )}
        </div>
        <ChevronDown size={14} className="text-text-dim" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-bg-elevated border border-border rounded-xl shadow-lg overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-medium text-text truncate">{displayName}</p>
            {user.email && (
              <p className="text-xs text-text-dim truncate">{user.email}</p>
            )}
          </div>
          <div className="py-1">
            <button
              onClick={() => { onHistory(); setOpen(false) }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-text-muted
                hover:bg-bg-hover hover:text-text transition-colors cursor-pointer"
            >
              <History size={16} />
              Extraction History
            </button>
            <button
              onClick={() => { onSignOut(); setOpen(false) }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-text-muted
                hover:bg-bg-hover hover:text-text transition-colors cursor-pointer"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
