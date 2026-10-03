'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'theme'

/** Product decision: light is the default. The OS preference is NOT followed. */
export const DEFAULT_THEME: Theme = 'light'

const THEME_EVENT = 'ngajaryuk:theme-change'

/**
 * The `.dark` class on <html> is the single source of truth — the same one the
 * blocking script in `src/app/layout.tsx` writes before first paint. Reading it
 * through `useSyncExternalStore` keeps the first client render identical to the
 * server HTML (no hydration mismatch) and still reflects the stored theme.
 */
function subscribe(onStoreChange: () => void) {
  window.addEventListener(THEME_EVENT, onStoreChange)
  return () => window.removeEventListener(THEME_EVENT, onStoreChange)
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function getServerSnapshot(): Theme {
  return DEFAULT_THEME
}

function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* storage blocked (private mode) — the class is still applied */
  }
  window.dispatchEvent(new Event(THEME_EVENT))
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const label = theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={cn(
        'focus-ring inline-flex size-10 items-center justify-center rounded-md',
        'border border-border-default bg-surface-card text-text-secondary',
        'transition-[background-color,border-color,color] duration-150 ease-out',
        'hover:border-border-strong hover:bg-surface-hover hover:text-text-primary',
        className
      )}
    >
      {theme === 'dark' ? (
        <Sun aria-hidden className="size-4" />
      ) : (
        <Moon aria-hidden className="size-4" />
      )}
    </button>
  )
}
