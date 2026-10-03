'use client'

// Leaflet ships its layout CSS as a separate file and nothing in this app
// imports it — only the CDN script is loaded. Without it the tile pane, panes
// and popups render unpositioned. Importing the vendor stylesheet here fixes
// the map without touching `globals.css`.
import 'leaflet/dist/leaflet.css'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  LocateFixed,
  MapPin,
  Navigation,
  Satellite,
  Send,
  ShieldAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { FeedbackBanner } from '@/components/ui/feedback-banner'
import { Field, Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { readDsToken } from '@/components/ui/swal-theme'

const SCHOOL_LAT = -7.5564
const SCHOOL_LON = 110.8347
const MAX_RADIUS = 1000 // meters

const initializedMapContainers = new WeakSet<HTMLDivElement>()

/** Indonesian thousands separator, so 1240 reads as "1.240 m". */
function formatMeters(meters: number): string {
  return meters.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/** `idle` doubles as "we have a result" — the result itself is `lokasi`/`distanceMeters`. */
type GeoStatus = 'idle' | 'locating' | 'denied' | 'unavailable' | 'failed'
type CameraStatus = 'idle' | 'starting' | 'denied' | 'failed'

/**
 * The three GPS failure modes a phone actually hits, in copy rather than a raw
 * `GeolocationPositionError.code`. The `error` banner keeps the original
 * `Gagal mengambil lokasi: …` text; this panel explains what to do next.
 */
const GEO_FAILURES = {
  denied: {
    title: 'Izin lokasi ditolak',
    body: 'Aktifkan izin lokasi untuk situs ini pada pengaturan browser, lalu tekan “Ambil Lokasi” sekali lagi.',
    icon: ShieldAlert,
  },
  unavailable: {
    title: 'Sinyal GPS tidak tersedia',
    body: 'Nyalakan lokasi pada perangkat dan coba lagi di tempat yang lebih terbuka, tanpa penghalang.',
    icon: Satellite,
  },
  failed: {
    title: 'Lokasi gagal dibaca',
    body: 'Terjadi kendala saat membaca GPS. Coba lagi; bila tetap gagal, muat ulang halaman ini.',
    icon: AlertTriangle,
  },
} as const satisfies Record<string, { title: string; body: string; icon: LucideIcon }>

export default function AbsensiForm({ userName }: { userName: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [lokasi, setLokasi] = useState('')
  const [alamat, setAlamat] = useState('')
  const [foto, setFoto] = useState('')
  const [isInsideRadius, setIsInsideRadius] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [currentLat, setCurrentLat] = useState<number | null>(null)
  const [currentLon, setCurrentLon] = useState<number | null>(null)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle')
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<unknown>(null)

  const locating = geoStatus === 'locating'
  const startingCamera = cameraStatus === 'starting'

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
    setCameraStatus('idle')
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  /**
   * Live clock, date and greeting. The three target nodes are rendered by
   * `page.tsx` (this mirrors what the `/admin` dashboard island does for its
   * own header). `userName` used to be accepted and dropped, which is why the
   * greeting node stayed empty.
   */
  useEffect(() => {
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
          day: 'numeric' as const,
          month: 'long' as const,
          year: 'numeric' as const,
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
        greetingEl.innerText = `${greeting}, ${userName}!`
      }
    }

    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [userName])

  // Initialize Leaflet map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return

    let map: L.Map | null = null

    import('leaflet').then((L) => {
      if (!mapRef.current) return

      const container = mapRef.current

      // Strict Mode / HMR safety: skip if this container was already initialized
      if (initializedMapContainers.has(container)) {
        return
      }

      map = L.map(container).setView([SCHOOL_LAT, SCHOOL_LON], 15)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      // Marker and fence colours come from the design-system tokens so the map
      // follows the light/dark palette instead of hard-coded hex.
      const schoolColor = readDsToken('--ds-danger-text')
      const fenceColor = readDsToken('--ds-info-text')

      // School marker
      const schoolIcon = L.divIcon({
        className: 'school-marker',
        html: `<div style="background-color: ${schoolColor}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })

      L.marker([SCHOOL_LAT, SCHOOL_LON], { icon: schoolIcon }).addTo(map).bindPopup('SMP ABBS Surakarta')

      // Radius circle
      L.circle([SCHOOL_LAT, SCHOOL_LON], {
        radius: MAX_RADIUS,
        color: fenceColor,
        fillColor: fenceColor,
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map)

      leafletMapRef.current = map
      setMapReady(true)
      initializedMapContainers.add(container)
    })

    return () => {
      if (map) {
        map.remove()
      }
    }
  }, [])

  // Update map marker when location changes
  useEffect(() => {
    if (!leafletMapRef.current || currentLat === null || currentLon === null) return

    import('leaflet').then((L) => {
      const map = leafletMapRef.current as L.Map
      const userColor = readDsToken('--ds-accent')
      const userIcon = L.divIcon({
        className: 'user-marker',
        html: `<div style="background-color: ${userColor}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })

      // Remove existing user markers
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker && (layer as L.Marker).getLatLng().lat !== SCHOOL_LAT) {
          map.removeLayer(layer)
        }
      })

      L.marker([currentLat, currentLon], { icon: userIcon }).addTo(map).bindPopup('Lokasi Anda')

      // Fit bounds to show both markers
      const bounds = L.latLngBounds([SCHOOL_LAT, SCHOOL_LON], [currentLat, currentLon])
      map.fitBounds(bounds, { padding: [50, 50] })
    })
  }, [currentLat, currentLon])

  async function startCamera() {
    setCameraStatus('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraActive(true)
      setCameraStatus('idle')
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      const isDenied = name === 'NotAllowedError' || name === 'SecurityError'
      setCameraStatus(isDenied ? 'denied' : 'failed')
      setError(
        'Tidak bisa membuka kamera: ' +
          (err instanceof Error ? err.message : 'Unknown error') +
          (isDenied
            ? ' Aktifkan izin kamera untuk situs ini pada pengaturan browser, lalu coba lagi.'
            : '')
      )
    }
  }

  function capturePhoto() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png')
    setFoto(dataUrl)
    stopCamera()
  }

  async function getLocation() {
    setError(null)
    if (!navigator.geolocation) {
      setGeoStatus('unavailable')
      setError('Browser Anda tidak mendukung Geolocation.')
      return
    }

    setGeoStatus('locating')

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        })
      })

      const lat = position.coords.latitude
      const lon = position.coords.longitude
      setLokasi(`${lat},${lon}`)
      setCurrentLat(lat)
      setCurrentLon(lon)
      setGeoStatus('idle')

      const distance = haversineDistance(lat, lon, SCHOOL_LAT, SCHOOL_LON)
      const inside = distance <= MAX_RADIUS
      setIsInsideRadius(inside)
      setDistanceMeters(distance)

      if (!inside) {
        setError(`Anda berada di luar radius sekolah (${distance.toFixed(2)} m). Presensi ditolak.`)
      }

      // Reverse geocoding
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=id`
        )
        const data = await res.json()
        setAlamat(data.display_name || 'Alamat tidak ditemukan')
      } catch {
        setAlamat('Alamat tidak ditemukan')
      }
    } catch (err) {
      if (err instanceof GeolocationPositionError) {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus('denied')
          setError(
            'Gagal mengambil lokasi: ' +
              err.message +
              ' Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini pada pengaturan browser, lalu coba lagi.'
          )
          return
        }
        if (err.code === err.POSITION_UNAVAILABLE) {
          setGeoStatus('unavailable')
          setError(
            'Gagal mengambil lokasi: ' +
              err.message +
              ' Sinyal GPS tidak tersedia. Nyalakan lokasi perangkat dan coba lagi di tempat yang lebih terbuka.'
          )
          return
        }
        setGeoStatus('failed')
        setError('Gagal mengambil lokasi: ' + err.message)
        return
      }

      setGeoStatus('failed')
      setError('Gagal mengambil lokasi: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (!lokasi || !alamat || !foto) {
      setError('Mohon pastikan lokasi, alamat, dan foto sudah diambil.')
      setLoading(false)
      return
    }

    if (!isInsideRadius) {
      setError('Anda tidak dapat melakukan presensi karena berada di luar area sekolah.')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/absensi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lokasi, alamat, foto }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Presensi gagal')
      }

      setSuccess('Presensi berhasil disimpan!')
      setLokasi('')
      setAlamat('')
      setFoto('')
      setIsInsideRadius(false)
      setCurrentLat(null)
      setCurrentLon(null)
      setDistanceMeters(null)
      setGeoStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  const readyToSubmit = Boolean(lokasi && alamat && foto) && isInsideRadius

  // `null` whenever the geofence panel is showing a real result or the idle hint.
  const geoFailure = GEO_FAILURES[geoStatus as keyof typeof GEO_FAILURES] ?? null
  const GeoStateIcon = geoFailure?.icon ?? MapPin

  return (
    <form id="absensiForm" onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error ? (
        <FeedbackBanner tone="error" onDismiss={() => setError(null)}>
          {error}
        </FeedbackBanner>
      ) : null}
      {success ? <FeedbackBanner tone="success">{success}</FeedbackBanner> : null}

      {/* Langkah 1 — Lokasi */}
      <Card>
        <CardHeader>
          <Badge variant="accent" className="shrink-0">
            Langkah 1
          </Badge>
          <div className="min-w-0 flex-1">
            <CardTitle>Lokasi Anda</CardTitle>
            <CardDescription>
              Presensi hanya tercatat bila Anda berada dalam radius {formatMeters(MAX_RADIUS)} meter
              dari SMP ABBS Surakarta.
            </CardDescription>
          </div>
          <Button
            onClick={getLocation}
            loading={locating}
            loadingText="Mencari…"
            aria-busy={locating || undefined}
          >
            <LocateFixed aria-hidden className="size-4" />
            Ambil Lokasi
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* Map. `.map-container` had no CSS rule, so the map used to collapse
              to zero height — the height is now set with a token-safe utility. */}
          <div className="relative overflow-hidden rounded-md border border-border-subtle">
            <div
              id="map"
              ref={mapRef}
              role="region"
              aria-label="Peta lokasi sekolah dan titik Anda"
              className="h-56 w-full sm:h-72"
            />

            {!mapReady ? (
              <div
                aria-hidden
                className="absolute inset-0 z-[600] flex flex-col gap-2 bg-surface-sunken p-4"
              >
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-4 w-32" />
                <div className="mt-auto flex items-center gap-2 text-[13px] text-text-tertiary">
                  <MapPin aria-hidden className="size-4" />
                  Memuat peta…
                </div>
              </div>
            ) : null}
          </div>

          {/* Geofence result — never colour alone: icon + wording + distance. */}
          {locating ? (
            <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-surface-sunken p-3">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-64" />
            </div>
          ) : lokasi && distanceMeters !== null ? (
            <div
              role="status"
              className={
                isInsideRadius
                  ? 'flex flex-col gap-1 rounded-md border border-success-border bg-success-bg p-3'
                  : 'flex flex-col gap-1 rounded-md border border-danger-border bg-danger-bg p-3'
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={isInsideRadius ? 'success' : 'danger'}>
                  {isInsideRadius ? (
                    <CheckCircle2 aria-hidden className="size-3.5" />
                  ) : (
                    <XCircle aria-hidden className="size-3.5" />
                  )}
                  {isInsideRadius ? 'Di dalam radius' : 'Di luar radius'}
                </Badge>
                <span className="text-[13px] font-semibold text-text-primary">
                  {formatMeters(distanceMeters)} m dari sekolah
                </span>
              </div>
              <p className="text-[13px] leading-relaxed text-text-secondary">
                {isInsideRadius
                  ? `Anda ${formatMeters(MAX_RADIUS - distanceMeters)} m di dalam batas area presensi. Lokasi siap dikirim.`
                  : `Anda ${formatMeters(distanceMeters - MAX_RADIUS)} m melewati batas area presensi. Presensi ditolak — dekati sekolah lalu ambil lokasi lagi.`}
              </p>
              <p className="font-mono text-xs text-text-tertiary">{lokasi}</p>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-md border border-border-subtle bg-surface-sunken p-3">
              <GeoStateIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-text-tertiary"
              />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-text-primary">
                  {geoFailure?.title ?? 'Lokasi belum diambil'}
                </p>
                <p className="text-[13px] text-text-tertiary">
                  {geoFailure?.body ??
                    'Tekan “Ambil Lokasi” dan izinkan browser mengakses GPS perangkat Anda.'}
                </p>
              </div>
            </div>
          )}

          <input type="hidden" id="lokasi" name="lokasi" value={lokasi} required />

          <Field
            id="alamat"
            label="Alamat terdeteksi"
            hint="Diisi otomatis dari koordinat GPS, dapat dibaca saja."
          >
            {(field) => (
              <Input
                {...field}
                name="alamat"
                type="text"
                value={alamat}
                readOnly
                placeholder="Lokasi akan muncul di sini"
                required
              />
            )}
          </Field>
        </CardContent>
      </Card>

      {/* Langkah 2 — Foto */}
      <Card>
        <CardHeader>
          <Badge variant="accent" className="shrink-0">
            Langkah 2
          </Badge>
          <div className="min-w-0 flex-1">
            <CardTitle>Foto kehadiran</CardTitle>
            <CardDescription>
              Selfie dengan kamera belakang, diambil langsung di lokasi sekolah.
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              if (!cameraActive && !foto) {
                startCamera()
              } else if (cameraActive) {
                capturePhoto()
              } else if (foto) {
                setFoto('')
                startCamera()
              }
            }}
            loading={startingCamera}
            loadingText="Menyiapkan…"
          >
            <Camera aria-hidden className="size-4" />
            {foto ? 'Ambil Foto Lagi' : 'Ambil Foto'}
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-sunken p-3">
            {/* Live camera feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-label="Pratinjau kamera"
              className={cameraActive ? 'w-full rounded-sm' : 'hidden'}
            />

            {/* Captured photo */}
            {foto ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- `foto` is a
                    base64 data URL produced by the local canvas; next/image cannot
                    optimise it and the object never leaves the device. */}
                <img
                  src={foto}
                  alt="Pratinjau foto kehadiran"
                  className="w-full rounded-sm border border-border-subtle"
                />
              </>
            ) : null}

            <canvas ref={canvasRef} className="hidden" />

            <input type="hidden" id="foto" name="foto" value={foto} required />

            {startingCamera ? (
              <div className="flex flex-col gap-2" role="status">
                <span className="sr-only">Menyiapkan kamera…</span>
                <Skeleton className="aspect-4/3 w-full" />
                <Skeleton className="h-3 w-48" />
              </div>
            ) : cameraActive ? (
              <p className="flex items-center gap-2 text-[13px] text-text-secondary">
                <Camera aria-hidden className="size-4 shrink-0 text-text-tertiary" />
                Kamera aktif. Tekan “Ambil Foto” untuk membekukan gambar.
              </p>
            ) : foto ? (
              <p className="flex items-center gap-2 text-[13px] font-medium text-success-text">
                <CheckCircle2 aria-hidden className="size-4 shrink-0" />
                Foto siap dikirim.
              </p>
            ) : cameraStatus === 'denied' ? (
              <div className="flex items-start gap-2.5 text-[13px] leading-relaxed text-danger-text">
                <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <p>
                  Izin kamera ditolak oleh browser. Buka pengaturan situs, izinkan akses
                  kamera, lalu tekan “Ambil Foto” sekali lagi.
                </p>
              </div>
            ) : cameraStatus === 'failed' ? (
              <div className="flex items-start gap-2.5 text-[13px] leading-relaxed text-danger-text">
                <Camera aria-hidden className="mt-0.5 size-4 shrink-0" />
                <p>
                  Kamera tidak dapat dibuka. Pastikan tidak ada aplikasi lain yang sedang
                  memakai kamera, lalu tekan “Ambil Foto” sekali lagi.
                </p>
              </div>
            ) : (
              <EmptyState
                icon="inbox"
                title="Belum ada foto"
                description="Ambil foto kehadiran dengan kamera belakang. Foto disimpan sebagai bukti presensi hari ini."
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Langkah 3 — Kirim */}
      <Card>
        <CardHeader>
          <Badge variant="accent" className="shrink-0">
            Langkah 3
          </Badge>
          <div className="min-w-0 flex-1">
            <CardTitle>Kirim presensi</CardTitle>
            <CardDescription>
              Data lokasi, alamat, dan foto dikirim bersama untuk diverifikasi admin.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold tracking-wide text-text-tertiary uppercase">
                Lokasi
              </dt>
              <dd className="text-[13px] text-text-primary">
                {lokasi && distanceMeters !== null ? (
                  <span className="flex items-center gap-1.5">
                    <Navigation aria-hidden className="size-3.5 shrink-0 text-text-tertiary" />
                    {formatMeters(distanceMeters)} m dari sekolah
                  </span>
                ) : (
                  <span className="text-text-tertiary">Belum diambil</span>
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs font-semibold tracking-wide text-text-tertiary uppercase">
                Foto
              </dt>
              <dd className="text-[13px] text-text-primary">
                {foto ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 aria-hidden className="size-3.5 shrink-0 text-success-text" />
                    Terambil
                  </span>
                ) : (
                  <span className="text-text-tertiary">Belum diambil</span>
                )}
              </dd>
            </div>
          </dl>

          {!readyToSubmit ? (
            <p className="flex items-start gap-2 text-[13px] leading-relaxed text-text-secondary">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-text" />
              Lengkapi langkah 1 dan 2 terlebih dahulu. Presensi hanya bisa dikirim bila lokasi
              berada di dalam radius dan foto sudah diambil.
            </p>
          ) : null}

          <Button
            type="submit"
            size="lg"
            loading={loading}
            loadingText="Mengirim presensi…"
            className="w-full sm:w-auto sm:self-start"
          >
            <Send aria-hidden className="size-4" />
            Kirim Absensi
          </Button>
        </CardContent>
      </Card>

      {/* Legend for the map, so the two markers are readable without hovering. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full border-2 border-white bg-danger-text shadow-xs"
          />
          Titik merah: SMP ABBS Surakarta
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full border-2 border-white bg-accent shadow-xs"
          />
          Titik hijau: posisi Anda
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-info-text/40" />
          Area radius {formatMeters(MAX_RADIUS)} m
        </span>
      </div>
    </form>
  )
}
