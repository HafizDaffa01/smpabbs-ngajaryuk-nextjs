import TeacherShell from '@/components/teacher-shell'
import Scripts from '@/components/scripts'

export const metadata = {
  title: {
    default: 'NgajarYuk - SMP ABBS Surakarta',
    template: '%s | NgajarYuk',
  },
}

/**
 * Teacher chrome for every route in this group. `TeacherShell` resolves the
 * signed-in teacher on the server and renders `AppShell`; signed-out visitors
 * get the page with no chrome (and no redirect — each page guards itself).
 *
 * `Scripts` is mounted here because it renders nothing and only owns the
 * global SweetAlert2 palette; a popup opened from `/journal`, `/absensi` or
 * `/profile` must be themed no matter which route opened it.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TeacherShell>
      {children}
      <Scripts />
    </TeacherShell>
  )
}