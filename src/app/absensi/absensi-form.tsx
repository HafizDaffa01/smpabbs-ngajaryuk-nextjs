'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const SCHOOL_LAT = -7.5564
const SCHOOL_LON = 110.8347
const MAX_RADIUS = 1000 // meters

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

export default function AbsensiForm(_props: { userName: string }) {
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
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<unknown>(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }, [])

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Initialize Leaflet map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current || mapReady) return

    import('leaflet').then((L) => {
      if (!mapRef.current) return

      const map = L.map(mapRef.current).setView([SCHOOL_LAT, SCHOOL_LON], 15)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(map)

      // School marker
      const schoolIcon = L.divIcon({
        className: 'school-marker',
        html: '<div style="background-color: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })

      L.marker([SCHOOL_LAT, SCHOOL_LON], { icon: schoolIcon }).addTo(map).bindPopup('SMP ABBS Surakarta')

      // Radius circle
      L.circle([SCHOOL_LAT, SCHOOL_LON], {
        radius: MAX_RADIUS,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        weight: 2,
      }).addTo(map)

      leafletMapRef.current = map
      setMapReady(true)
    })
  }, [mapReady])

  // Update map marker when location changes
  useEffect(() => {
    if (!mapReady || !leafletMapRef.current || currentLat === null || currentLon === null) return

    import('leaflet').then((L) => {
      const map = leafletMapRef.current as L.Map
      const userIcon = L.divIcon({
        className: 'user-marker',
        html: '<div style="background-color: #22c55e; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
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
  }, [mapReady, currentLat, currentLon])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setCameraActive(true)
    } catch (err) {
      setError('Tidak bisa membuka kamera: ' + (err instanceof Error ? err.message : 'Unknown error'))
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
      setError('Browser Anda tidak mendukung Geolocation.')
      return
    }

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

      const distance = haversineDistance(lat, lon, SCHOOL_LAT, SCHOOL_LON)
      const inside = distance <= MAX_RADIUS
      setIsInsideRadius(inside)

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-200">
          {success}
        </div>
      )}

      {/* Map */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <span className="mr-1">🗺️</span> Peta Lokasi
        </label>
        <div
          ref={mapRef}
          className="h-[300px] w-full rounded-md border border-zinc-300 dark:border-zinc-700"
          style={{ zIndex: 0 }}
        />
        {!mapReady && (
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Memuat peta...</p>
        )}
      </div>

      {/* Lokasi */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <span className="mr-1">📍</span> Lokasi
        </label>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={lokasi}
            readOnly
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="Koordinat akan muncul di sini"
          />
          <input
            type="text"
            value={alamat}
            readOnly
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            placeholder="Alamat akan muncul di sini"
          />
          <button
            type="button"
            onClick={getLocation}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Ambil Lokasi
          </button>
        </div>
      </div>

      {/* Foto */}
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <span className="mr-1">📷</span> Foto
        </label>
        <div className="flex flex-col gap-2">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full rounded-md border border-zinc-300 ${cameraActive ? 'block' : 'hidden'}`}
            style={{ maxHeight: '300px' }}
          />
          <canvas ref={canvasRef} className="hidden" />
          {foto && (
            <img
              src={foto}
              alt="Preview"
              className="w-full rounded-md border border-zinc-300"
              style={{ maxHeight: '300px' }}
            />
          )}
          <div className="flex gap-2">
            {!cameraActive && !foto && (
              <button
                type="button"
                onClick={startCamera}
                className="flex-1 rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300"
              >
                Buka Kamera
              </button>
            )}
            {cameraActive && (
              <button
                type="button"
                onClick={capturePhoto}
                className="flex-1 rounded-md bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-900"
              >
                Ambil Foto
              </button>
            )}
            {foto && (
              <button
                type="button"
                onClick={() => {
                  setFoto('')
                  startCamera()
                }}
                className="flex-1 rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-300"
              >
                Ambil Foto Lagi
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-green-600 px-4 py-3 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Memproses...' : 'Kirim Absensi'}
      </button>
    </form>
  )
}
