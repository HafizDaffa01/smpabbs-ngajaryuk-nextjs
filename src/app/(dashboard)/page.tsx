import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  GraduationCap,
  MapPin,
  NotebookPen,
  Quote,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ButtonLink } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const hadiths = [
  {
    arabic: "مَنْ دَعَا إِلَى هُدًى كَانَ لَهُ مِنَ الأَجْرِ مِثْلُ أُجُورِ مَنْ تَبِعَهُ لاَ يَنْقُصُ ذَلِكَ مِنْ أُجُورِهِمْ شَيْئًا",
    translation:
      '"Barang siapa yang mengajak kepada petunjuk (kebaikan/ilmu), maka baginya pahala seperti pahala orang-orang yang mengikutinya tanpa mengurangi pahala mereka sedikit pun."',
    source: "HR. Muslim (No. 2674), Abu Dawud (No. 4607), Tirmidzi (No. 2674).",
  },
  {
    arabic: "مَنْ جَاءَ مَسْجِدِي هَذَا لَمْ يَأْتِهِ إِلاَّ لِخَيْرٍ يَتَعَلَّمُهُ أَوْ يُعَلِّمُهُ فَهُوَ بِمَنْزِلَةِ الْمُجَاهِدِ فِي سَبِيلِ اللَّهِ",
    translation:
      '"Barang siapa yang datang ke mesjidku ini, tidak lain kecuali untuk kebaikan yang ingin dipelajarinya atau dia ajarkan, maka kedudukannya sama dengan orang yang berjihad di jalan Allah."',
    source: "HR. Ibnu Majah (No. 227), Ahmad (No. 8590).",
  },
  {
    arabic: "وَمَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ",
    translation:
      '"Barang siapa menempuh jalan untuk mencari ilmu, maka Allah akan memudahkan baginya jalan menuju surga."',
    source: "HR. Muslim (No. 2699), Abu Dawud (No. 3641).",
  },
  {
    arabic: "إِنَّ اللَّهَ وَمَلائِكَتَهُ وَأَهْلَ السَّمَاوَاتِ وَالْأَرْضَ حَتَّى النَّمْلَةَ فِي جُحْرِهَا وَحَتَّى الْحُوتَ لَيُصَلُّونَ عَلَى مُعَلِّمِ النَّاسِ الْخَيْرَ",
    translation:
      '"Sesungguhnya Allah, para malaikat-Nya, serta penghuni langit dan bumi—hingga semut di lubangnya dan ikan-ikan di lautan—benar-benar bersalawat (mendoakan kebaikan) untuk orang yang mengajarkan kebaikan kepada manusia."',
    source: "HR. Tirmidzi (No. 2685).",
  },
  {
    arabic: "إِذَا مَاتَ الْإِنْسَانُ انْقَطَعَ عَنْهُ عَمَلُهُ إِلَّا مِنْ ثَلَاثَةٍ: إِلَّا مِنْ صَدَقَةٍ جَارِيَةٍ، أَوْ عِلْمٍ يُنْتَفَعُ بِهِ، أَوْ وَلَدٍ صَالِحٍ يَدْعُو لَهُ",
    translation:
      '"Jika seorang manusia meninggal dunia, terputuslah amalnya kecuali tiga perkara: sedekah jariyah, ilmu yang dimanfaatkan, atau anak saleh yang mendoakannya."',
    source: "HR. Muslim (No. 1631), Abu Dawud (No. 2880), Tirmidzi (No. 1376).",
  },
  {
    arabic: "وَإِنَّ الْعُلَمَاءَ وَرِثَةُ الْأَنْبِيَاءِ، وَإِنَّ الْأَنْبِيَاءَ لَمْ يُوَرِّثُوا دِينَارًا وَلَا دِرْهَمًا، وَإِنَّمَا وَرَّثُوا الْعِلْمَ، فَمَنْ أَخَذَهُ أَخَذَ بِحَظٍّ وَافِرٍ",
    translation:
      '"Sesungguhnya ulama (orang berilmu/pengajar) adalah pewaris para nabi. Para nabi tidak mewariskan dinar maupun dirham, melainkan mewariskan ilmu. Barang siapa yang mengambilnya, sungguh ia telah mengambil bagian yang sangat banyak."',
    source: "HR. Abu Dawud (No. 3641), Tirmidzi (No. 2682), Ibnu Majah (No. 223).",
  },
  {
    arabic: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
    translation:
      '"Sebaik-baik kalian adalah orang yang mempelajari Al-Qur\'an dan mengajarkannya."',
    source: "HR. Bukhari (No. 5027).",
  },
  {
    arabic: "لَيْسَ مِنْ أُمَّتِي مَنْ لَمْ يُجِلَّ كَبِيرَنَا، وَيَرْحَمْ صَغِيرَنَا، وَيَعْرِفْ لِعَالِمِنَا حَقَّهُ",
    translation:
      '"Bukan termasuk umatku orang yang tidak memuliakan yang lebih tua di antara kami, tidak menyayangi yang lebih muda, dan tidak mengetahui hak bagi ulama (guru/orang berilmu) kami."',
    source: "HR. Ahmad (No. 22845), Al-Hakim dalam Al-Mustadrak (1/122).",
  },
  {
    arabic: "مَنْ سُئِلَ عَنْ عِلْمٍ فَكَتَمَهُ أَلْجَمَهُ اللَّهُ بِلِجَامٍ مِنْ نَارٍ يَوْمَ الْقِيَامَةِ",
    translation:
      '"Barang siapa yang ditanya tentang suatu ilmu lalu ia menyembunyikannya, maka Allah akan mengekasnya dengan kekang dari api neraka pada hari kiamat."',
    source: "HR. Abu Dawud (No. 3658), Tirmidzi (No. 2649), Ibnu Majah (No. 261).",
  },
  {
    arabic: "مَنْ سَنَّ فِي الْإِسْلَامِ سُنَّةً حَسَنَةً فَلَهُ أَجْرُهَا وَأَجْرُ مَنْ عَمِلَ بِهَا بَعْدَهُ مِنْ غَيْرَ أَنْ يَنْقُصَ مِنْ أُجُورِهِمْ شَيْءٌ",
    translation:
      '"Barang siapa merintis/mengajarkan suatu kebiasaan baik dalam Islam, maka baginya pahala atas perbuatannya itu dan pahala orang-orang yang mengamalkannya setelahnya, tanpa mengurangi pahala mereka sedikit pun."',
    source: "HR. Muslim (No. 1017).",
  },
]

function getRandomHadith() {
  return hadiths[Math.floor(Math.random() * hadiths.length)]
}

export const metadata = {
  title: 'Beranda - NgajarYuk',
  description: 'Beranda NgajarYuk',
}

/** Daily entry points, in the order a teacher needs them. */
const QUICK_LINKS = [
  { href: '/absensi', label: 'Absensi', hint: 'Catat kehadiran siswa', icon: MapPin },
  { href: '/journal', label: 'Jurnal', hint: 'Susun journaling kelas', icon: NotebookPen },
  { href: '/schedule', label: 'Jadwal', hint: 'Lihat jadwal mengajar', icon: CalendarDays },
  { href: '/prevSmes', label: 'Prev Semester', hint: 'Rekap nilai semester lalu', icon: BarChart3 },
]

/**
 * Arabic needs three things the Latin type system does not: a font with real
 * naskh glyphs, a generous line box (marks sit above and below the baseline),
 * and RTL flow. `--font-amiri` is loaded in `src/app/layout.tsx`; the fallback
 * chain matches the one `globals.css` already declares for `.arabic-text`.
 */
const ARABIC_FONT_STACK =
  "var(--font-amiri), 'Traditional Arabic', 'Scheherazade New', 'Times New Roman', serif"

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, is_admin')
    .eq('id', user.id)
    .single()

  const randomHadith = getRandomHadith()
  const teacherName = profile?.name?.trim() || user.email || 'Guru'
  const firstName = teacherName.split(' ')[0]

  return (
    <div className="flex flex-col gap-5">
      {/* ---- Hero ------------------------------------------------ */}
      <section className="relative overflow-hidden rounded-lg border border-accent-border bg-gradient-to-br from-accent-subtle via-surface-card to-surface-card shadow-sm">
        {/* Decorative depth: soft concentric rings, hidden from AT. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 hidden size-72 rounded-full border border-accent-border/60 sm:block"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-8 hidden size-56 rounded-full border border-accent-border/40 sm:block"
        />

        <div className="relative flex flex-col gap-5 p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <Badge variant="success" className="gap-1.5">
              <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-success-text" />
              Sistem aktif
            </Badge>
            <span className="eyebrow">Portal Guru</span>
          </div>

          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-2">
              <h1 className="text-display text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
                Selamat Datang, {firstName}
              </h1>
              <p className="prose-block max-w-xl text-text-secondary">
                Anda telah berhasil masuk ke sistem Jurnal Kelas. Silakan gunakan menu
                navigasi untuk mengakses fitur-fitur yang tersedia.
              </p>
            </div>

            <span
              aria-hidden
              className="hidden size-20 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent shadow-sm sm:flex"
            >
              <GraduationCap className="size-10" />
            </span>
          </div>

          <div className="action-row flex flex-col gap-2 sm:flex-row sm:items-center">
            <ButtonLink href="/journal" size="lg">
              <NotebookPen aria-hidden className="size-4" />
              Buka Jurnal
            </ButtonLink>
            <ButtonLink href="/schedule" variant="secondary" size="lg">
              <CalendarDays aria-hidden className="size-4" />
              Lihat Jadwal
            </ButtonLink>
          </div>
        </div>
      </section>

      {/* ---- Hadith + quick links --------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader>
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-accent-subtle text-accent-subtle-text"
              >
                <Quote className="size-4" />
              </span>
              <div className="flex min-w-0 flex-col">
                <CardTitle as="h2">Hadits Hari Ini</CardTitle>
                <CardDescription>
                  Mutiarakataan pilihan hari ini
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col gap-4">
            <blockquote className="flex flex-col gap-4">
              <p
                lang="ar"
                dir="rtl"
                style={{ fontFamily: ARABIC_FONT_STACK }}
                className="text-right text-xl leading-[2] text-text-primary sm:text-2xl"
              >
                {randomHadith.arabic}
              </p>

              <div aria-hidden className="h-px bg-border-subtle" />

              <p className="text-[15px] leading-relaxed text-text-secondary italic">
                {randomHadith.translation}
              </p>

              <footer className="meta">{randomHadith.source}</footer>
            </blockquote>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle as="h2" className="text-sm">
              Akses Cepat
            </CardTitle>
          </CardHeader>

          <ul className="flex flex-1 flex-col gap-1 p-2">
            {QUICK_LINKS.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="focus-ring group flex items-center gap-3 rounded-md p-2.5 transition-colors duration-150 ease-out hover:bg-surface-hover"
                  >
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-surface-sunken text-text-secondary transition-colors duration-150 ease-out group-hover:bg-accent-subtle group-hover:text-accent-subtle-text"
                    >
                      <Icon className="size-[18px]" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold text-text-primary">
                        {item.label}
                      </span>
                      <span className="truncate text-xs text-text-tertiary">{item.hint}</span>
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="size-4 shrink-0 text-text-disabled transition-transform duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-accent-text"
                    />
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </div>
  )
}