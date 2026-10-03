'use client'

import { useSwalTheme } from '@/components/ui/swal-theme'

/**
 * Global client-side wiring for the teacher routes. Renders nothing.
 *
 * What used to live here and why it is gone:
 *
 * - `feather.replace()` — hydrated `<i data-feather>` placeholders from the
 *   Feather icon library. Feather is fully gone now (icons are lucide-react
 *   components), so the call was removed.
 * - The SweetAlert2 CDN `<Script>` — superseded by the npm `sweetalert2`
 *   package, which the pages import directly.
 *
 * What remains: SweetAlert2 mounts its popup on `<body>`, outside the shell
 * cascade, so the design-system palette has to be applied imperatively — and
 * re-applied whenever the light/dark class on `<html>` changes.
 */
export default function Scripts() {
  useSwalTheme()

  return null
}