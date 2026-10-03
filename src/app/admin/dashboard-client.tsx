'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  BookOpenCheck,
  CalendarCheck,
  ClipboardList,
  School,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Button } from '@/components/ui/button'
import { BarChart, type BarDatum } from '@/components/ui/bar-chart'
import { Skeleton } from '@/components/ui/skeleton'
import { readDsToken, themedSwal, useSwalTheme } from '@/components/ui/swal-theme'

type DashboardStats = {
  teachersCount: number
  adminsCount: number
  accountsCount: number
  teacherShare: number
  studentsCount: number
  averagePerClass: number
  classCount: number
  notesCount: number
  notesCheckedCount: number
}

type DashboardClientProps = {
  users: { id: string; name: string; email: string }[]
  absensiCount: number
  studentsByClass: Record<string, { name: string }[]>
  currentKey: string
  stats: DashboardStats
  /** Raw `absensis.waktu` timestamps from the last 7 days, bucketed locally. */
  weekTimes: string[]
}

/** Monday-first week, matching the Indonesian Sen–Min convention. */
const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const DAY_NAMES = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
]

const DAY_MS = 86_400_000

/**
 * `true` in the browser, `false` during SSR — read through
 * `useSyncExternalStore` so hydration, not a state-setting effect, is what
 * reveals the client-only view.
 */
function subscribeToNothing() {
  return () => {}
}
function clientSnapshot() {
  return true
}
function serverSnapshot() {
  return false
}

/** Inline SVG so the popup body never depends on the FontAwesome CDN. */
const CHART_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>'

export default function DashboardClient({
  users,
  absensiCount,
  studentsByClass,
  currentKey,
  stats,
  weekTimes,
}: DashboardClientProps) {
  // Restyles SweetAlert2 for the active theme, now and on every theme switch.
  useSwalTheme()

  /* ------------------------------------------------------------------ *
   * Weekly check-in series.
   * Bucketing is done here rather than in the RSC so "hari ini" and the
   * Sen–Min axis follow the viewer's clock instead of the server's. The
   * server has no such clock, so the chart is withheld until hydration and
   * holds its space with a skeleton — the alternative is a mismatch.
   * ------------------------------------------------------------------ */
  const mounted = useSyncExternalStore(subscribeToNothing, clientSnapshot, serverSnapshot)

  const week = useMemo(() => {
    const now = new Date()
    const monday = new Date(now)
    monday.setHours(0, 0, 0, 0)
    monday.setDate(monday.getDate() - ((now.getDay() + 6) % 7))

    const counts = new Array<number>(7).fill(0)
    for (const iso of weekTimes) {
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) continue
      const day = new Date(date)
      day.setHours(0, 0, 0, 0)
      const offset = Math.round((day.getTime() - monday.getTime()) / DAY_MS)
      if (offset >= 0 && offset < 7) counts[offset] += 1
    }

    const todayIndex = (now.getDay() + 6) % 7
    const data: BarDatum[] = DAY_LABELS.map((label, index) => ({
      label,
      description: DAY_NAMES[index],
      value: counts[index],
      isToday: index === todayIndex,
    }))

    return {
      data,
      today: counts[todayIndex],
      yesterday: todayIndex > 0 ? counts[todayIndex - 1] : 0,
    }
  }, [weekTimes])

  /* ------------------------------------------------------------------ *
   * Detail popups — registered on `window`, exactly as before.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    function popupWidth() {
      if (window.innerWidth <= 480) return '95vw'
      if (window.innerWidth <= 768) return '90vw'
      return '700px'
    }

    function responsiveTitle(modal: HTMLElement) {
      const title = modal.querySelector('.swal2-title')
      if (title) {
        ;(title as HTMLElement).style.fontSize = window.innerWidth <= 480 ? '1.2rem' : '1.5rem'
      }
    }

    ;(window as unknown as Record<string, unknown>).showTeachersPopup = () => {
      const totalTeachers = users.length
      const teacherContent = `
        <div class="ny-pop-title">Daftar Guru (Total: ${totalTeachers})</div>
        <div class="ny-pop-scroll">
          <ol class="ny-pop-list">
            ${users
              .map(
                (teacher, index) => `<li><strong>${index + 1}.</strong> ${teacher.name}</li>`
              )
              .join('')}
          </ol>
        </div>
      `

      themedSwal().fire({
        title: 'Daftar Guru',
        html: teacherContent,
        icon: 'info',
        confirmButtonText: 'Tutup',
        confirmButtonColor: readDsToken('--ds-info-text'),
        width: popupWidth(),
        padding: '20px',
        scrollbarPadding: false,
        didOpen: responsiveTitle,
      })
    }

    ;(window as unknown as Record<string, unknown>).showAbsenciPopup = () => {
      const today = new Date()
      const dateOptions = {
        weekday: 'long' as const,
        year: 'numeric' as const,
        month: 'long' as const,
        day: 'numeric' as const,
      }
      const todayDate = today.toLocaleDateString('id-ID', dateOptions)

      const html = `
        <div class="ny-pop-muted">Tanggal:</div>
        <div class="ny-pop-value">${todayDate}</div>
        <div class="ny-pop-box" style="margin-top:.75rem">
          <div class="ny-pop-muted">Total Absensi</div>
          <div class="ny-pop-value">${absensiCount}</div>
        </div>
        <a href="/export?period=${currentKey}" class="ny-pop-link">
          ${CHART_ICON} Lihat Backup Panel
        </a>
      `

      themedSwal().fire({
        title: 'Absensi',
        html,
        icon: 'info',
        confirmButtonText: 'Tutup',
        confirmButtonColor: readDsToken('--ds-success-text'),
        width: popupWidth(),
        padding: '20px',
        scrollbarPadding: false,
        didOpen: responsiveTitle,
      })
    }

    ;(window as unknown as Record<string, unknown>).showClassesPopup = () => {
      const filteredClasses = Object.fromEntries(
        Object.entries(studentsByClass).filter(([key]) => key !== 'Kelas')
      )
      const totalClasses = Object.keys(filteredClasses).length

      const classContent = `
        <div class="ny-pop-title">Daftar Kelas (Total: ${totalClasses})</div>
        <div class="ny-pop-scroll">
          ${Object.entries(filteredClasses)
            .map(
              ([className, roster]) => `
            <div class="ny-pop-item">
              <strong>${className}</strong>
              <p class="ny-pop-muted" style="margin:.125rem 0 0">${roster.length} siswa</p>
            </div>
          `
            )
            .join('')}
        </div>
      `

      themedSwal().fire({
        title: 'Ringkasan Kelas',
        html: classContent,
        icon: 'info',
        confirmButtonText: 'Tutup',
        confirmButtonColor: readDsToken('--ds-info-text'),
        width: popupWidth(),
        padding: '20px',
        scrollbarPadding: false,
        didOpen: responsiveTitle,
      })
    }

    ;(window as unknown as Record<string, unknown>).showStudentsPopup = () => {
      const filteredClasses = Object.fromEntries(
        Object.entries(studentsByClass).filter(([key]) => key !== 'Kelas')
      )
      const totalStudents = Object.values(filteredClasses)
        .flat()
        .filter((s) => s.name !== 'Nama').length

      const html = `
        <div class="ny-pop-title">Daftar Siswa (Total: ${totalStudents})</div>
        <div class="ny-pop-scroll">
          ${Object.entries(filteredClasses)
            .map(([className, roster]) => {
              const filteredStudents = roster.filter((s) => s.name !== 'Nama')
              return `
            <div class="ny-pop-item">
              <strong>Kelas ${className}</strong>
              <p class="ny-pop-muted" style="margin:.125rem 0 .25rem">Siswa (${filteredStudents.length}):</p>
              <ul class="ny-pop-list">
                ${filteredStudents.map((student) => `<li>${student.name}</li>`).join('')}
              </ul>
            </div>
          `
            })
            .join('')}
        </div>
      `

      themedSwal().fire({
        title: 'Detail Siswa Per Kelas',
        html,
        icon: 'info',
        confirmButtonText: 'Tutup',
        confirmButtonColor: readDsToken('--ds-warning-text'),
        width: popupWidth(),
        padding: '20px',
        scrollbarPadding: false,
        didOpen: responsiveTitle,
      })
    }

    /* Live clock + greeting. The nodes it writes to live in `page.tsx`. */
    function updateClock() {
      const now = new Date()
      const timeOptions = {
        hour: '2-digit' as const,
        minute: '2-digit' as const,
        second: '2-digit' as const,
      }
      const clockEl = document.getElementById('clock')
      const dateEl = document.getElementById('date')
      const greetingEl = document.getElementById('greeting')

      if (clockEl) {
        clockEl.innerText = now.toLocaleTimeString('id-ID', timeOptions).replace(/\./g, ':')
      }
      if (dateEl) {
        const dateOptions = {
          weekday: 'long' as const,
          year: 'numeric' as const,
          month: 'long' as const,
          day: 'numeric' as const,
        }
        dateEl.innerText = now.toLocaleDateString('id-ID', dateOptions)
      }
      if (greetingEl) {
        const hour = now.getHours()
        let greeting: string
        if (hour >= 4 && hour < 11) greeting = 'Selamat pagi'
        else if (hour >= 11 && hour < 15) greeting = 'Selamat siang'
        else if (hour >= 15 && hour < 18) greeting = 'Selamat sore'
        else greeting = 'Selamat malam'
        greetingEl.innerText = `${greeting}, Admin!`
      }
    }

    const interval = setInterval(updateClock, 1000)
    updateClock()

    return () => clearInterval(interval)
  }, [users, absensiCount, studentsByClass, currentKey])

  /* ------------------------------------------------------------------ *
   * Stat cards
   * ------------------------------------------------------------------ */
  const delta = week.today - week.yesterday
  const notesRatio =
    stats.notesCount === 0
      ? 0
      : Math.round((stats.notesCheckedCount / stats.notesCount) * 100)

  function openPopup(name: 'showTeachersPopup' | 'showStudentsPopup' | 'showClassesPopup' | 'showAbsenciPopup') {
    ;(window as unknown as Record<string, (() => void) | undefined>)[name]?.()
  }

  const cardOverlay =
    'focus-ring absolute inset-0 cursor-pointer rounded-md transition-shadow duration-150 ease-out motion-reduce:transition-none'
  const clickableCard =
    'relative group transition-[border-color,box-shadow] duration-150 ease-out group-hover:border-border-strong group-hover:shadow-md group-focus-within:border-border-strong group-focus-within:shadow-md motion-reduce:transition-none'

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Stretched-button pattern: the card is decorative, the overlay
            button carries the label and the whole tile is the tap target. */}
        <div className={clickableCard}>
          <StatCard
            className="h-full"
            label="Total Guru"
            value={stats.teachersCount.toLocaleString('id-ID')}
            hint={`${stats.teacherShare}% dari ${stats.accountsCount.toLocaleString('id-ID')} akun · ${stats.adminsCount.toLocaleString('id-ID')} admin`}
            icon={<Users className="size-5" />}
            tone="info"
          />
          <button
            type="button"
            onClick={() => openPopup('showTeachersPopup')}
            aria-label="Lihat detail Total Guru"
            className={cardOverlay}
          />
        </div>

        <div className={clickableCard}>
          <StatCard
            className="h-full"
            label="Total Siswa"
            value={stats.studentsCount.toLocaleString('id-ID')}
            hint={`Rata-rata ${stats.averagePerClass} siswa per kelas`}
            icon={<School className="size-5" />}
            tone="warning"
          />
          <button
            type="button"
            onClick={() => openPopup('showStudentsPopup')}
            aria-label="Lihat detail Total Siswa"
            className={cardOverlay}
          />
        </div>

        <div className={clickableCard}>
          <StatCard
            className="h-full"
            label="Absensi Hari Ini"
            value={
              mounted ? (
                week.today.toLocaleString('id-ID')
              ) : (
                <Skeleton className="h-8 w-14" />
              )
            }
            trend={
              mounted
                ? {
                    value:
                      delta === 0
                        ? 'Sama dengan kemarin'
                        : `${delta > 0 ? '+' : '−'}${Math.abs(delta)} vs kemarin`,
                    tone: delta === 0 ? 'neutral' : delta > 0 ? 'positive' : 'negative',
                  }
                : undefined
            }
            hint={`Dari ${absensiCount.toLocaleString('id-ID')} total absensi`}
            icon={<CalendarCheck className="size-5" />}
            tone="success"
          />
          <button
            type="button"
            onClick={() => openPopup('showAbsenciPopup')}
            aria-label="Lihat detail absensi hari ini"
            className={cardOverlay}
          />
        </div>

        <StatCard
          className="h-full"
          label="Jurnal Terisi"
          value={stats.notesCount.toLocaleString('id-ID')}
          hint={`${stats.notesCheckedCount.toLocaleString('id-ID')} sudah diperiksa (${notesRatio}%)`}
          icon={<BookOpenCheck className="size-5" />}
          tone="accent"
        />
      </div>

      {/* Class roster strip — keeps the class roster popup one click away. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-card px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-text"
          >
            <ClipboardList className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {stats.classCount.toLocaleString('id-ID')} kelas aktif
            </p>
            <p className="text-[13px] text-text-tertiary">
              Rata-rata {stats.averagePerClass} siswa per kelas
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => openPopup('showClassesPopup')}
        >
          Lihat daftar kelas
        </Button>
      </div>

      {/* Weekly attendance */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Absensi Mingguan</CardTitle>
            <CardDescription>
              Jumlah check-in guru per hari, Senin sampai Minggu.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {mounted ? (
            <BarChart
              data={week.data}
              ariaLabel={`Absensi guru mingguan, Senin ${week.data[0].value} hingga Minggu ${week.data[6].value} check-in.`}
              valueLabel="Check-in"
              unit="check-in"
            />
          ) : (
            <Skeleton className="h-52 w-full" />
          )}

          <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-subtle pt-3 text-[13px] text-text-tertiary">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full bg-accent" />
              Hari ini
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-full bg-accent-300" />
              Hari lain
            </li>
            <li className="meta ml-auto">Angka di atas batang = jumlah check-in</li>
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
