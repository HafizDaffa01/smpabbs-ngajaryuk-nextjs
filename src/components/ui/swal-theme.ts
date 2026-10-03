'use client'

import * as React from 'react'
import Swal from 'sweetalert2'

/**
 * SweetAlert2 renders into a container appended to `<body>`, i.e. OUTSIDE
 * `[data-ds-shell]`. It therefore cannot inherit the shell's cascade and has to
 * be themed from the `--ds-*` tokens itself — which also makes it follow the
 * light/dark toggle instead of being pinned to one palette.
 *
 * Implementation note: `Swal.setDefaults()` was removed in sweetalert2 v11.26,
 * so the design-doc suggestion is implemented with `Swal.mixin()`, the
 * supported replacement ("returns an extended version of Swal containing
 * params as defaults"). The instance is rebuilt whenever the theme flips.
 *
 * Popup body styling lives in the `.ny-pop*` rules in `src/app/globals.css`,
 * which are token-driven for the same reason.
 */

type SwalInstance = ReturnType<typeof Swal.mixin>

/** Reads a design-system token as a plain CSS colour. */
export function readDsToken(token: string, fallback = ''): string {
  if (typeof window === 'undefined') return fallback
  return (
    getComputedStyle(document.documentElement).getPropertyValue(token).trim() || fallback
  )
}

function isDark(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  )
}

function themeParams() {
  return {
    background: readDsToken('--ds-surface-raised'),
    color: readDsToken('--ds-text-secondary'),
    titleColor: readDsToken('--ds-text-primary'),
    titleFontSize: '1.25rem',
    titleFontWeight: '700',
    htmlContainerColor: readDsToken('--ds-text-secondary'),
    iconColor: readDsToken('--ds-accent-text'),
    confirmButtonColor: readDsToken('--ds-accent'),
    confirmButtonTextColor: readDsToken('--ds-on-accent'),
    cancelButtonColor: readDsToken('--ds-surface-sunken'),
    cancelButtonTextColor: readDsToken('--ds-text-primary'),
    denyButtonColor: readDsToken('--ds-danger-text'),
    closeButtonColor: readDsToken('--ds-text-tertiary'),
    customClass: {
      popup: 'ny-popup',
      confirmButton: 'ny-swal-button',
      cancelButton: 'ny-swal-button',
      denyButton: 'ny-swal-button',
      closeButton: 'ny-swal-close',
    },
  }
}

let themed: SwalInstance | null = null
let themedFor: 'light' | 'dark' | null = null

/**
 * A SweetAlert2 instance pre-configured with the design-system palette for the
 * theme that is currently active. Memoised per theme, so calling it at popup
 * time is free.
 */
export function themedSwal(): SwalInstance {
  const theme = isDark() ? 'dark' : 'light'
  if (!themed || themedFor !== theme) {
    themedFor = theme
    themed = Swal.mixin(themeParams())
  }
  return themed
}

/**
 * Warms the themed instance and keeps it in sync with the `.dark` class on
 * `<html>`, so a popup opened after a theme switch is styled for that theme.
 */
export function useSwalTheme() {
  React.useEffect(() => {
    themedSwal()

    if (typeof MutationObserver === 'undefined') return
    const observer = new MutationObserver(() => themedSwal())
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
}
