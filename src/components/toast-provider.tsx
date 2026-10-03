'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: number
  type: ToastType
  text: string
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (type: ToastType, text: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * Each tone is a complete `{border, background, text}` triple from the `--ds-*`
 * semantic ramps, so the toast keeps its contrast in both light and dark
 * without a single `dark:` override. The icon carries the meaning alongside the
 * colour, and errors are announced assertively while everything else is a
 * polite `role="status"`.
 */
const TOAST_TONES = {
  success: {
    wrapper: 'border-success-border bg-success-bg text-success-text',
    Icon: CheckCircle2,
    role: 'status',
  },
  error: {
    wrapper: 'border-danger-border bg-danger-bg text-danger-text',
    Icon: XCircle,
    role: 'alert',
  },
  warning: {
    wrapper: 'border-warning-border bg-warning-bg text-warning-text',
    Icon: AlertTriangle,
    role: 'status',
  },
  info: {
    wrapper: 'border-info-border bg-info-bg text-info-text',
    Icon: Info,
    role: 'status',
  },
} as const satisfies Record<ToastType, { wrapper: string; Icon: typeof Info; role: 'alert' | 'status' }>

const TOAST_TTL_MS = 3000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const idRef = useRef(0)
  // Timers are tracked so the provider can clear them on unmount. Without this
  // the old `setTimeout` fired `setToasts` after the root layout unmounted.
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const addToast = useCallback((type: ToastType, text: string) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, type, text }])
    timersRef.current.set(
      id,
      setTimeout(() => {
        timersRef.current.delete(id)
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, TOAST_TTL_MS)
    )
  }, [])

  const dismissToast = useCallback((id: number) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast }}>
      {children}

      {/*
        `pointer-events-none` on the viewport so the strip never swallows clicks
        on the page underneath; each toast opts back in. Width is capped and
        inset on small screens, so the strip cannot cause horizontal scroll at
        375px.
      */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-20 z-9999 flex flex-col items-stretch gap-2 sm:left-auto sm:w-88"
      >
        {toasts.map((toast) => {
          const tone = TOAST_TONES[toast.type]
          const Icon = tone.Icon

          return (
            <div
              key={toast.id}
              role={tone.role}
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 rounded-md border px-3 py-2.5 shadow-md',
                'text-[13px] font-medium',
                tone.wrapper
              )}
            >
              <Icon aria-hidden className="mt-px size-4 shrink-0" />
              <p className="min-w-0 flex-1 leading-relaxed">{toast.text}</p>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Tutup pemberitahuan"
                className="-my-1 -mr-1 shrink-0 rounded-sm p-1 opacity-70 transition-opacity duration-150 ease-out hover:opacity-100"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}