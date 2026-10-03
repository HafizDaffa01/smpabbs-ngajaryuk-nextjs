import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Camera, Clock, Hand, Lock, MapPin, Send, WifiOff } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import AbsensiForm from './absensi-form'

export const metadata = {
  title: 'Presensi Guru',
  description: 'Halaman presensi guru',
}

const STEPS = [
  {
    icon: MapPin,
    title: 'Ambil lokasi',
    body: 'Izinkan browser mengakses GPS. Anda harus berada dalam radius 1.000 meter dari sekolah.',
  },
  {
    icon: Camera,
    title: 'Ambil foto',
    body: 'Kamera belakang dibuka langsung di halaman ini, lalu satu foto dibekukan sebagai bukti.',
  },
  {
    icon: Send,
    title: 'Kirim presensi',
    body: 'Lokasi, alamat, dan foto dikirim ke server dan diverifikasi kembali oleh admin.',
  },
]

export default async function AbsensiPage() {
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
    .select('name')
    .eq('id', user.id)
    .single()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader
        title="Presensi Guru"
        crumbs={[{ label: 'Beranda', href: '/' }, { label: 'Presensi' }]}
        description={
          <span className="flex flex-col gap-1">
            <span id="greeting" className="font-semibold text-text-primary">
              Selamat datang!
            </span>
            <span>
              Tiga langkah: pastikan Anda berada di sekolah, ambil foto kehadiran, lalu kirim
              untuk diverifikasi admin.
            </span>
          </span>
        }
        actions={
          <div className="rounded-md border border-border-subtle bg-surface-card px-3 py-2 text-right shadow-xs">
            <p className="flex items-center justify-end gap-1.5 text-sm font-bold tabular-nums text-text-primary">
              <Clock aria-hidden className="size-4 text-text-tertiary" />
              <span id="clock">--:--:--</span>
            </p>
            <p id="date" className="text-[13px] text-text-tertiary">
              --
            </p>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <AbsensiForm userName={profile?.name ?? 'Guru'} />
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Cara melakukan presensi</CardTitle>
              <CardDescription>Ikuti urutan berikut, berurutan dari atas.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-4">
                {STEPS.map((step, index) => (
                  <li key={step.title} className="flex gap-3">
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-subtle-text"
                    >
                      <step.icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-text-primary">
                        <span className="text-text-tertiary">{index + 1}.</span> {step.title}
                      </p>
                      <p className="text-[13px] leading-relaxed text-text-tertiary">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Izin perangkat</CardTitle>
              <CardDescription>
                Kamera dan GPS hanya bisa diakses melalui koneksi aman.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-text-tertiary" />
                <p className="text-[13px] leading-relaxed text-text-secondary">
                  Browser hanya mengizinkan kamera dan lokasi pada situs HTTPS. Jika tombol
                  “Ambil Lokasi” atau “Ambil Foto” tidak merespons, pastikan alamat situs memakai
                  <span className="font-semibold text-text-primary"> https://</span>.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <WifiOff aria-hidden className="mt-0.5 size-4 shrink-0 text-text-tertiary" />
                <p className="text-[13px] leading-relaxed text-text-secondary">
                  Peta dan pencarian alamat memerlukan koneksi internet. Presensi tetap dapat
                  diambil lokasi dan foto tanpa internet, tetapi alamat tidak dapat diverifikasi.
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Hand aria-hidden className="mt-0.5 size-4 shrink-0 text-text-tertiary" />
                <p className="text-[13px] leading-relaxed text-text-secondary">
                  Satu presensi per hari. Bila langkah 1 atau 2 gagal, tekan tombolnya sekali
                  lagi untuk mengulanginya.
                </p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
