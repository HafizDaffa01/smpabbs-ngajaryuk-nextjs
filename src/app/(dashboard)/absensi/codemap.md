# src/app/absensi/

## Responsibility

Teacher self check-in ("Presensi Guru") — the origin of every `absensis` row. The route proves three things at once: **the teacher is physically at school** (GPS geofence around SMP ABBS Surakarta), **they are present right now** (a base64 selfie from the rear camera), and it then hands the record to the admin pipeline that decides the `S`/`I`/`A` status.

| File | Kind | Lines | Exports |
|---|---|---|---|
| `page.tsx` | Async Server Component | 58 | `metadata`, default `AbsensiPage` |
| `absensi-form.tsx` | Client Component (`'use client'`) | 381 | default `AbsensiForm` |

## Design

### `page.tsx` — server shell

- Auth gate: `cookies()` → `createClient(cookieStore)` → `auth.getUser()` → `redirect('/login')`.
- Reads `profiles.select('name').eq('id', user.id).single()` and passes `profile?.name ?? 'Guru'` as `userName`.
- Renders `.attendance-container` > `.card-brutalist` with a `.section-label` `ABSENSI_GURU` header, a `.status-bar` holding a lucide `Clock` plus `.time-display` > `#clock.clock-text` / `#date.date-text`, and a `.greeting-section` with a lucide `Hand` and `<h4 id="greeting">`.

**Two concrete gaps in this shell, both verified by reading every file in the route:**

1. **`userName` is accepted but unused.** `absensi-form.tsx` declares `export default function AbsensiForm(_props: { userName: string })` — the underscore-prefixed destructuring means the name never reaches the DOM, so `#greeting` stays empty.
2. **The live clock and greeting never get filled.** `#clock`, `#date`, and `#greeting` are empty elements with no writer in this route. The only `document.getElementById('greeting')` implementation in the codebase lives in `src/app/admin/dashboard-client.tsx` (lines 187–203, the `/admin` route), which is a different page. The CSS for `.time-display`, `.clock-text`, `.date-text`, `.greeting-section` exists in `src/app/globals.css` (lines ~1179–1204), so the styles are live but the content is not. (The same empty `id="greeting"` appears in `src/app/admin/page.tsx:102` and *is* populated there by `dashboard-client.tsx`.)

### `absensi-form.tsx` — client, all device access lives here

**Geofence constants** (duplicated verbatim in `src/app/api/absensi/route.ts`):

```ts
const SCHOOL_LAT = -7.5564
const SCHOOL_LON = 110.8347
const MAX_RADIUS = 1000 // meters
```

`haversineDistance(lat1, lon1, lat2, lon2)` implements the haversine formula with `R = 6371000` m, returning metres.

**Leaflet map lifecycle.** Leaflet is loaded with a runtime `import('leaflet')` inside `useEffect` (never at module scope), and the container is a `<div id="map" className="map-container">`. On init: `L.map(container).setView([SCHOOL_LAT, SCHOOL_LON], 15)`, an OpenStreetMap tile layer `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` with `© OpenStreetMap contributors` attribution, a red `L.divIcon` (`className: 'school-marker'`) marker bound to the popup `'SMP ABBS Surakarta'`, and an `L.circle(..., { radius: MAX_RADIUS, color: '#3b82f6', fillOpacity: 0.1, weight: 2 })` showing the 1 km fence. Cleanup calls `map.remove()`.

**StrictMode / HMR guard:** module-scope `const initializedMapContainers = new WeakSet<HTMLDivElement>()` — before creating a map the effect returns early if `initializedMapContainers.has(container)`, and the container is only added after successful creation. This is what stops React 19 double-effects from throwing *"Map container is already initialized"*. `leafletMapRef` (`useRef<unknown>`) keeps the instance.

**User marker effect** (`[currentLat, currentLon]`): re-imports leaflet, sweeps every `L.Marker` whose `getLatLng().lat !== SCHOOL_LAT` off the map, adds a green `user-marker` `divIcon` with popup `'Lokasi Anda'`, then `map.fitBounds(bounds, { padding: [50, 50] })` over both points.

**`getLocation()` — the geolocation + geocoding flow:**

1. Bail with `'Browser Anda tidak mendukung Geolocation.'` if `!navigator.geolocation`.
2. `getCurrentPosition` wrapped in a `Promise<GeolocationPosition>` with `{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }`.
3. `setLokasi(\`${lat},${lon}\`)` — a comma-joined **string**, which is exactly what `absensis.lokasi` (TEXT) stores. Also `setCurrentLat/ setCurrentLon` to drive the marker.
4. `haversineDistance(...) <= MAX_RADIUS` → `setIsInsideRadius`; if outside, `setError(\`Anda berada di luar radius sekolah (${distance.toFixed(2)} m). Presensi ditolak.\`)` (still continues to geocode, so the address is available for review).
5. Reverse geocoding via `https://nominatim.openstreetmap.org/reverse?lat=&lon=&format=json&accept-language=id` → `setAlamat(data.display_name || 'Alamat tidak ditemukan')`, with `'Alamat tidak ditemukan'` on any fetch/parse failure.

**`akurasi` is never captured.** `position.coords.accuracy` is not read anywhere in this route and the POST body is only `{ lokasi, alamat, foto }`. Consequently `absensis.akurasi` (`supabase/schema.sql` line 48) stays `NULL` for every check-in produced here. The column is declared and consumed elsewhere — `src/types/index.ts:33` and `src/app/admin/absensi/absensi-client.tsx:17` both type it `akurasi?: string | null`, `/api/export/backup-save/route.ts:79` writes it explicitly as `null`, and `/api/export/export-lokasi/route.ts:62` plus `/api/export/route.ts:56` render `a.akurasi || ''` into the exported CSV/XLSX.

**Camera / photo handling:**

- `startCamera()` → `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })` (rear camera), stores the `MediaStream` in `streamRef`, assigns `videoRef.current.srcObject`, `setCameraActive(true)`. Failure → `'Tidak bisa membuka kamera: ' + message`.
- `capturePhoto()` sizes a hidden `<canvas>` to `video.videoWidth || 640` × `video.videoHeight || 480`, `ctx.drawImage(video, 0, 0, w, h)`, then `canvas.toDataURL('image/png')` → `setFoto(dataUrl)`, then `stopCamera()`.
- `stopCamera()` (a `useCallback`) stops every track and nulls `streamRef`; a `useEffect` cleanup calls it on unmount, so navigating away releases the camera.
- The photo button is a 3-way toggle: `!cameraActive && !foto` → start camera; `cameraActive` → capture; `foto` present → clear `foto` and restart the camera ("Ambil Foto Lagain").
- `foto` is mirrored into `<input type="hidden" id="foto">`, `lokasi` into `<input type="hidden" id="lokasi">`, and `alamat` into a `readOnly` text input — i.e. the form is *uncontrolled-looking but fully controlled by React state*, the hidden inputs exist for the Laravel-era form shape.

**`handleSubmit()` guards, in order:** all three of `lokasi`/`alamat`/`foto` present (`'Mohon pastikan lokasi, alamat, dan foto sudah diambil.'`), then `isInsideRadius` (`'Anda tidak dapat melakukan presensi karena berada di luar area sekolah.'`). On success it clears `lokasi`, `alamat`, `foto`, `isInsideRadius`, `currentLat`, `currentLon` (but not `mapReady`) so the teacher can check in again after the server's duplicate rule clears.

**State inventory:** `loading`, `error`, `success`, `lokasi`, `alamat`, `foto`, `isInsideRadius`, `cameraActive`, `mapReady`, `currentLat`, `currentLon`; refs `videoRef`, `canvasRef`, `streamRef`, `mapRef`, `leafletMapRef`. No context, no store, no toast — feedback is two inline `role="alert"` divs styled inline with `var(--danger-soft)` / `var(--success-soft)` and matching `*-soft-text` foregrounds, matching design spec §4.5.

## Data Flow

### Client → server

```
AbsensiForm.handleSubmit
  POST /api/absensi            Content-Type: application/json
  { lokasi: "lat,lon", alamat: "<nominatim display_name>", foto: "data:image/png;base64,..." }
```

### `src/app/api/absensi/route.ts` (POST) — the authoritative validation

Server-side Supabase client from `@/utils/supabase/server` (cookie store). Order of checks:

1. `auth.getUser()` → **401** `Unauthorized`.
2. Missing `lokasi`/`alamat`/`foto` → **400** `'Lokasi, alamat, dan foto harus diisi'`.
3. `lokasi.split(',')` → `parseFloat` both halves; `isNaN` → **400** `'Koordinat tidak valid'`.
4. **Server-side geofence re-check** with its own copy of `haversineDistance` and `SCHOOL_LAT/SCHOOL_LON/MAX_RADIUS`; `distance > MAX_RADIUS` → **403** with the same message text as the client.
5. **One check-in per teacher per day:** `absensis.select('id, waktu').eq('user_id', user.id).gte('waktu', <today 00:00 local→ISO>).lt('waktu', <today 23:59:59.999→ISO>).maybeSingle()`; a hit → **409** `'Anda sudah presensi hari ini'`. (The day bounds are built with `new Date(new Date().setHours(...))`, i.e. server-local timezone, not `absensis.waktu`'s `timestamptz` semantics.)
6. Photo: strip `^data:image/\w+;base64,` → `Buffer.from(base64)`; `> 5 * 1024 * 1024` → **400** `'Ukuran foto terlalu besar (maksimal 5MB)'`; MIME sniffed with `/data:image\/(\w+);base64/` and checked against `['image/jpeg','image/png','image/gif','image/webp']` → **400** otherwise.
7. `profiles.select('name, phone_num')` → **404** `'Profile tidak ditemukan'` when the row is missing.
8. **Storage upload** to the `uploads` bucket: filename `${profile.name.replace(/[^a-zA-Z0-9_.-]/g,'_')}@${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.${ext}`, `upsert: false` → **500** `'Gagal upload foto'` on failure. Then `supabase.storage.from('uploads').getPublicUrl(fileName)` — a **public** URL, despite `schema.sql:306` commenting "Public: false (use signed URLs)".
9. **Insert into `absensis`:** `{ user_id, nama: profile.name, unit: 'SMP ABBS Surakarta', lokasi, alamat, foto: <publicUrl>, waktu: new Date().toISOString() }`. `value` and `akurasi` are deliberately **not** written → both `NULL`.
10. **WhatsApp notification** (fire-and-forget, `.catch(console.error)`, never blocks the response): if `profile.phone_num` strips to a non-empty digit string, it maps the EN weekday through `dayMap` to Indonesian, formats `tglNow`/`jamNow` with `id-ID`, looks up today's lessons with `schedules.select('period, subject, class_name').ilike('teacher', '%'+profile.name+'%').eq('day', dayEn).order('period')`, renders `- Jam N: subject (class_name)` lines (or `'(Tidak ada jadwal hari ini)'`), and POSTs to `https://api.fonnte.com/send` with `Authorization: process.env.FONNTE_API_KEY`, body `{ target: <phone>, message, countryCode: '62', device?: FONNTE_DEVICE_ID }`. The message embeds a link to `gurusmpabbs.alabidin.sch.id/journal`.
11. Returns `{ success: true }`; any thrown error → **500** `'Terjadi kesalahan server'`.

### Where the `S`/`I`/`A` value actually gets set

`absensis.value CHAR(1) CHECK (value IN ('S','I','A'))` is **not** decided on check-in. Two admin-side writers own it:

- `src/app/admin/absensi/absensi-client.tsx` — inline cell editor sends `PUT /api/admin/absensi/{id}` with `{ [field]: value }`.
- `src/app/api/export/backup-save/route.ts` — the payroll/backup grid; on a missing row it creates a *placeholder* `absensis` record (`lokasi: '-'`, `alamat: '-'`, `foto: null`, `akurasi: null`, `waktu: \`${date}T00:00:00\``, `value`), otherwise it `update({ value })`s the existing row.

### Read path

`GET /api/admin/absensi?year=&month=` feeds `src/app/admin/absensi/absensi-client.tsx`, which renders the photo/lokasi/akurasi columns. Deletion goes through `DELETE /api/admin/absensi/{id}` (which also removes the Storage object derived from `absentsi.foto.split('/').pop()`), plus `/api/admin/absensi/delete-all` and `/api/admin/absensi/delete-by-period`.

## Integration Points

- **Browser APIs:** `navigator.geolocation` (`enableHighAccuracy`), `navigator.mediaDevices.getUserMedia`, `<canvas>.toDataURL`, `<video>.srcObject`, `HTMLMediaElement` track teardown.
- **Third-party network calls (client):** OpenStreetMap tiles, `nominatim.openstreetmap.org` reverse geocoding.
- **Third-party network calls (server):** `api.fonnte.com` WhatsApp gateway, gated on `FONNTE_API_KEY` / `FONNTE_DEVICE_ID`.
- **APIs:** `POST /api/absensi` (this page); `POST /api/auth/logout`; admin CRUD under `/api/admin/absensi/*`.
- **Shared components:** none beyond `lucide-react` icons. The page does not use `ToastProvider` (its own inline alerts) nor `sweetalert2`.
- **Tables/columns:** `absensis` (`user_id`, `nama`, `unit`, `lokasi`, `alamat`, `foto`, `akurasi`, `waktu`, `value`); `profiles` (`name`, `phone_num`); `schedules` (`day`, `period`, `subject`, `class_name`, `teacher`) for the WhatsApp digest.
  - **Root layout globals:** Leaflet is loaded via a dynamic `import('leaflet')`
    plus `import 'leaflet/dist/leaflet.css'` in `absensi-form.tsx` itself (no CDN
    `<Script>` in `src/app/layout.tsx` anymore), so the component is self-contained.
- **Auth:** route is in `middleware.ts`'s `protectedRoutes`, so unauthenticated visits are bounced to `/login?redirect=/absensi` before this component runs; the page repeats the check itself.
- **Security note:** the geofence is enforced twice (client for UX, server for authority) but both copies hardcode the same constants — there is no configuration source, and a client-side `isInsideRadius` check alone would be trivially bypassable if the server copy were removed.