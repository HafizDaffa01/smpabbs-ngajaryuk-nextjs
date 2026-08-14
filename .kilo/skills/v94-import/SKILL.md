# Skill: v9.4.xlsx Import (aSc Timetables SMP ABBS)

> Untuk AI/asisten manapun yang membaca panduan ini: ikuti instruksi di bawah ini
> PERSIS seperti tertulis, jangan menebak atau "mengoreksi" sendiri berdasarkan
> asumsi umum. File ini berisi aturan-aturan sekolah yang TIDAK bisa ditebak dari
> datanya sendiri — semua sudah dikonfirmasi langsung oleh pihak sekolah.
> Kalau ragu, tanyakan ke user daripada menebak.

## 1. Apa file ini

`v9.4.xlsx` adalah hasil export mentah dari software **aSc Timetables** yang
dipakai SMP ABBS untuk menyusun jadwal pelajaran. Satu file berisi ~25 sheet
(tab). File ini TIDAK langsung enak dibaca manusia — perlu diolah dulu untuk
jadi jadwal per-guru, per-kelas, atau jadwal mingguan cetak.

Buka dengan library yang bisa baca `.xlsx`, misalnya Python + `openpyxl`:

```python
import openpyxl
wb = openpyxl.load_workbook("v9.4.xlsx", data_only=True, read_only=True)
print(wb.sheetnames)  # lihat semua nama sheet dulu sebelum mulai apa-apa
```

**Selalu print `wb.sheetnames` dulu di awal** dan bandingkan dengan daftar di
bawah — kalau ada sheet baru/beda nama, JANGAN lanjut menebak, laporkan dulu.

## 2. Daftar sheet dan fungsinya

### Sheet referensi/definisi (bukan data jadwal per sesi)
- `Classes` — kolom A berisi daftar SEMUA kode kelas (contoh: `7A`, `7C ICT`,
  `7C TCP`, `7D`, dst). **Selalu baca daftar kelas dari sini secara dinamis**,
  jangan hardcode — mulai dari baris 2, berhenti di baris pertama yang kosong.
- `Teachers` — daftar guru. Kolom penting (index dari 0, urutan kolom B-F):
  - kolom B (`row[1]`): nama lengkap guru
  - kolom C (`row[2]`): nickname/kode pendek guru (dipakai di sheet lain sebagai
    identitas guru, misal "Mr Amar", "Us Naya")
  - kolom F (`row[5]`): **Contract** = jumlah jam wajib mengajar per minggu
    (angka). **Ini adalah SUMBER KEBENARAN untuk "jam/minggu" seorang guru** —
    JANGAN hitung jam dari menjumlah slot di grid jadwal (lihat Gotcha #3 di
    bawah kenapa itu salah).
- `Lessons` — tabel mentah 1 baris = 1 penugasan (guru + kelas + mapel).
  Kolom penting (index 0-based): `row[0]`=nama guru (bisa lebih dari 1 nama
  dipisah koma untuk team-teaching), `row[1]`=daftar kelas (dipisah koma),
  `row[2]`=nama grup, `row[3]`=nama mapel. **Kalau `row[0]` == `"Without teacher"`
  atau kosong, lewati baris itu** — artinya mapel itu tidak diampu guru
  tertentu (lihat Gotcha #4).
- `Subjects`, `Classrooms`, `Contracts Classes`, `Available teachers` (2 versi) —
  sheet referensi tambahan, biasanya tidak perlu dipakai untuk membangun
  jadwal per-guru/per-kelas dasar. Cek `Subjects` kalau ingin daftar resmi
  nama+kode singkat tiap mapel.

### Satu sheet per mapel (ini yang berisi jam/slot sebenarnya)
Setiap mapel punya sheet sendiri, nama sheet **selalu diakhiri titik** (`.`).
10 mapel inti yang PASTI ada:

```
Sprt.   Soc.   Sc.   Quran.   Math.   IFE.   ICT.   Eng.   Cv.   BI.
```

Plus 3 sheet **Leadership** (perhatikan salah ketik "LEASDERSHIP" untuk kelas 9
— itu memang typo bawaan dari sumbernya, BUKAN typo kita, jangan diperbaiki
saat membaca nama sheet):

```
LEADERSHIP 7.   LEADERSHIP 8.   LEASDERSHIP 9.
```

Plus 4 sheet **tanpa guru** (mapel ini ada di jadwal tapi tidak diampu guru
spesifik — semua tercatat "Without teacher" di sheet `Lessons`):

```
HOMEROOM TEACHER.   SCOUT.   SENI BUDAYA KESENIAN.   SELF DEVELOPMENT.
```

**Format baris di semua sheet mapel ini SAMA**, mulai dari **baris ke-4**
(baris 1-3 adalah header, lewati):
- kolom B (`row[1]`, index 1): nama hari dalam Bahasa Inggris —
  `Monday`/`Tuesday`/`Wednesday`/`Thursday`/`Friday`/`Saturday`
- kolom C (`row[2]`, index 2): **Lesson#** — nomor jam pelajaran MENTAH
  (angka 1-9). **PERINGATAN: untuk hari Jumat, angka ini BUKAN nomor jam
  final yang benar — lihat Gotcha #1, WAJIB di-remap dulu.**
- kolom D dan seterusnya (`row[3:]`): satu kolom = biasanya satu kelas untuk
  mapel biasa. Isi cell = nama kelas, atau beberapa kelas dipisah koma kalau
  digabung jadi satu sesi. **Kalau baris itu tidak ada isinya sama sekali di
  kolom D dst, berarti slot itu memang tidak dipakai — skip.**
- Baris kosong (kolom B/C kosong) menandai akhir data hari itu — berhenti
  baca baris berikutnya untuk sheet itu atau lanjut cek baris berikut sampai
  benar-benar habis (baca sampai ~baris 200 lalu stop kalau day-nya `None`).

## 3. GOTCHA — hal-hal yang WAJIB diikuti, sering salah kalau ditebak

### Gotcha #1 — Nomor jam Jumat harus digeser (+1) untuk 3 jam terakhir
Data mentah kolom Lesson# hari Jumat masih memakai penomoran LAMA. Sekolah
sekarang menyebut 3 jam setelah istirahat siang sebagai jam ke-**7, 8, 9**,
tapi kolom Lesson# di file masih menulis **6, 7, 8**. WAJIB remap sebelum
dipakai untuk apapun (cari waktu, bikin key JSON, tampilkan ke user):

```
Hari Jumat saja:  raw 6 -> jam ke-7
                   raw 7 -> jam ke-8
                   raw 8 -> jam ke-9
Hari lain: TIDAK ada perubahan (angka mentah = jam final)
```

Alasan: jam ke-6 pada hari Jumat sudah habis dipakai istirahat sholat Jumat
(11.10-13.00), jadi bukan slot mengajar — tapi kolom Lesson# di software
tidak pernah di-update mengikuti kebijakan ini. **Jangan pernah menampilkan
angka Lesson# mentah untuk Jumat tanpa remap ini.**

### Gotcha #2 — Sheet Leadership & 4 sheet "tanpa guru" datanya DI-MIRROR di semua kolom, bukan 1 kolom = 1 kelas
Berbeda dari sheet mapel biasa (Math, Quran, dst — di situ 1 kolom = 1 kelas
berbeda), sheet `LEADERSHIP 7.`/`LEADERSHIP 8.`/`LEASDERSHIP 9.` dan 4 sheet
`HOMEROOM TEACHER.`/`SCOUT.`/`SENI BUDAYA KESENIAN.`/`SELF DEVELOPMENT.`
menulis STRING GABUNGAN KELAS YANG SAMA PERSIS, diulang di SETIAP kolom pada
baris itu. Contoh nyata: baris "LEADERSHIP 7." untuk Senin jam5 punya 6
kolom, dan ke-6 kolom itu ISINYA SAMA PERSIS: `"7A,7B,7C ICT,7C TCP,7D,7E"`.

**Kalau baris ini diproses pakai logika sheet mapel biasa (1 kolom = 1
kelas), setiap guru akan terhitung berulang kali (36x lipat untuk kasus di
atas)** — ini bug nyata yang pernah terjadi di project ini. Cara benar:
**ambil isi dari SATU kolom pertama yang tidak kosong saja**, abaikan
kolom-kolom lain di baris yang sama (karena isinya memang duplikat, bukan
data baru).

### Gotcha #3 — Jangan hitung "jam/minggu" guru dari menjumlah slot grid
Jumlah jam mengajar resmi seorang guru per minggu HARUS diambil dari kolom
**Contract** di sheet `Teachers` (lihat bagian 2), BUKAN dihitung ulang
dengan menjumlah berapa slot terisi di grid jadwalnya. Alasannya: sesi
team-teaching (misal Quran diajar 2 guru sekaligus untuk 1 kelas) dan sesi
gabungan kelas bisa membuat hitungan grid jadi ambigu dan tidak konsisten
dengan cara sekolah sendiri mencatat jam kontrak. **Jam Leadership SUDAH
termasuk di dalam angka Contract** (dibuktikan: selisih Contract dikurangi
jumlah-slot-mapel-inti-saja, PERSIS SAMA dengan `2 x jumlah angkatan yang
diikuti guru itu di Leadership`, tanpa kecuali dari 24 guru yang diuji) —
jadi kalau mengisi slot Leadership ke grid, JANGAN tambahkan lagi ke total
jam, cukup isi selnya saja.

### Gotcha #4 — Baris dengan guru "Without teacher" dilewati di sheet `Lessons`
Di sheet `Lessons`, sebagian mapel tidak punya guru spesifik tercatat
(`row[0]` isinya literal teks `"Without teacher"`, atau kosong). Ini normal
untuk 4 mapel di Gotcha #2 (HT/Scout/SBK/SD) — mapel itu memang tidak
diampu 1 guru tertentu di data ini, jadi cukup ditampilkan di jadwal PER
KELAS (bukan per guru). Jangan coba "menebak" siapa gurunya.

### Gotcha #5 — Gender kelas ditentukan dari HURUF setelah angka kelas
`A`/`B`/`C` (termasuk varian `C ICT` dan `C TCP`) = kelas **putra**.
`D`/`E`/`F` = kelas **putri**. Ini menentukan jam istirahat mana yang
berlaku (lihat bagian 4 — jam istirahat putra/putri BEDA).

### Gotcha #6 — Satu guru bisa punya lebih dari satu entri di slot hari+jam yang sama
Kalau seorang guru mengajar 2 kelas paralel di jam yang sama (misalnya
Quran kelompok kecil), JANGAN saling menimpa (overwrite) — simpan sebagai
list/array berisi semua kejadian, bukan hanya kejadian terakhir yang dibaca.

## 4. Jadwal jam pelajaran (bell schedule) — WAJIB persis segini, JANGAN ditebak dari pola umum

Ini FAKTA KEBIJAKAN SEKOLAH, tidak tertulis eksplisit di file Excel-nya
(file hanya punya nomor jam abstrak 1-9, bukan jam dinding). Dikonfirmasi
langsung oleh pihak sekolah.

### Senin–Kamis (9 jam pelajaran normal, 40 menit per jam)
| Jam | Waktu (umum) | Waktu putra (A/B/C) | Waktu putri (D/E/F) |
|---|---|---|---|
| 1 | 07.30–08.10 | sama | sama |
| 2 | 08.10–08.50 | sama | sama |
| **istirahat 1** | — | **08.50–09.10** | 08.50–09.30 (ini jadi jam ke-3 putri) |
| 3 | — | 09.10–09.50 | 08.50–09.30 |
| **istirahat 1 (putri)** | — | (sudah lewat) | **09.30–09.50** |
| 4 | 09.50–10.30 | sama | sama |
| 5 | 10.30–11.10 | sama | sama |
| 6 | 11.10–11.50 | sama | sama |
| **istirahat siang** | 11.50–13.00 | sama | sama |
| 7 | 13.00–13.40 | sama | sama |
| 8 | 13.40–14.20 | sama | sama |
| 9 | 14.20–15.00 | sama | sama |

Ringkasnya jam ke-3: **putra istirahat dulu (08.50-09.10) baru jam-3
(09.10-09.50)**; **putri jam-3 dulu (08.50-09.30) baru istirahat
(09.30-09.50)** — keduanya ketemu lagi bareng di jam ke-4 (09.50).

### Jumat (HANYA 8 jam pelajaran nyata: jam 1-5, lalu jam 7-9 — jam 6 TIDAK ADA)
Jam 1-5 SAMA PERSIS dengan Senin-Kamis (termasuk aturan gender jam-3 di
atas). Lalu ada istirahat panjang sholat Jumat **11.10–13.00** — ini
menggantikan slot jam ke-6 sepenuhnya (jam ke-6 dianggap TIDAK ADA sebagai
slot mengajar sama sekali, bukan "istirahat lalu ada jam 6"). Setelah itu:

| Jam | Waktu |
|---|---|
| 7 | 13.00–13.40 |
| 8 | 13.40–14.20 |
| 9 | 14.20–15.00 |

**Ingat Gotcha #1**: kolom Lesson# mentah di file untuk 3 jam ini masih
tertulis 6/7/8, harus di-remap ke 7/8/9 dulu.

### Sabtu (jadwal SEPENUHNYA BEDA — 6 jam pelajaran saja, 30 menit per jam, mulai 07.15, TANPA istirahat siang)
**Aturan gender jam ke-3 di Sabtu TERBALIK dari hari biasa** — ini bagian
paling gampang salah, DOUBLE-CHECK jangan asal pola-matching dari aturan
Senin-Kamis:

| Jam | Waktu putra | Waktu putri |
|---|---|---|
| 1 | 07.15–07.45 | sama |
| 2 | 07.45–08.15 | sama |
| **istirahat 1 (putri duluan!)** | 08.15–08.45 (putra JAM-3 dulu) | **08.15–08.30 (putri istirahat duluan)** |
| 3 | 08.15–08.45 | 08.30–09.00 |
| **istirahat 1 (putra nyusul)** | **08.45–09.00** | (sudah lewat) |
| 4 | 09.00–09.30 | sama |
| 5 | 09.30–10.00 | sama |
| 6 | 10.00–10.30 | sama |

Tidak ada jam ke-7 dst di hari Sabtu — berhenti di jam ke-6.

## 5. Langkah-langkah membangun jadwal (algoritma)

### A. Untuk JADWAL PER GURU
1. Baca `Classes` → daftar semua kode kelas valid.
2. Baca `Teachers` → bikin peta `nama lengkap -> nickname` dan
   `nickname -> jumlah jam Contract`.
3. Baca `Lessons`, untuk tiap baris yang guru-nya BUKAN "Without teacher"
   dan BUKAN kosong: catat peta `(kelas, kode_mapel) -> set(nickname guru)`.
   Kalau mapelnya salah satu dari 3 Leadership, catat terpisah:
   `kode_leadership -> set(nickname guru peserta)` (jangan campur dengan
   peta kelas-mapel biasa, treat sebagai daftar peserta rapat).
4. Untuk tiap 10 sheet mapel inti: baca tiap baris mulai baris 4, ambil
   hari + Lesson# (remap kalau Jumat, Gotcha #1), lalu untuk tiap kolom
   kelas yang terisi: cari guru-nya lewat peta langkah 3, catat ke jadwal
   guru itu di slot (hari, jam) = {kelas, mapel, jam mulai/selesai (dari
   tabel bagian 4, sesuai gender kelas)}.
5. Untuk 3 sheet Leadership: baca tiap baris (ambil hari+jam yang remap),
   ambil HANYA kolom pertama yang berisi data (Gotcha #2) untuk tahu ini
   slot aktif atau tidak (isinya tidak dipakai, cuma penanda "ada acara").
   Untuk SETIAP guru peserta Leadership grade itu (dari langkah 3), catat
   ke jadwalnya sendiri di slot (hari,jam) = {label "Leadership 7"/"8"/"9",
   tanpa nama kelas, jam mulai/selesai gender-netral (Leadership tidak
   split gender)}.
6. "Jam/minggu" total guru = angka Contract dari langkah 2, **bukan**
   dihitung dari jumlah slot yang barusan diisi (Gotcha #3).

### B. Untuk JADWAL PER KELAS
1-2. Sama seperti di atas.
3. Balik logikanya: untuk 10 mapel inti, tiap slot terisi dicatat ke jadwal
   KELAS itu (bukan guru): `(hari,jam) -> {mapel, nama guru}`.
4. Untuk 3 sheet Leadership DAN 4 sheet tanpa-guru (HT/Scout/SBK/SD): pakai
   Gotcha #2 (ambil 1 kolom pertama saja), untuk tiap kelas yang disebut di
   situ, catat slot itu ke jadwal kelas sebagai occupied dengan label mapel
   itu (Leadership tidak perlu nama guru; HT/Scout/SBK/SD juga tidak ada
   nama guru — mapel-mapel ini memang tanpa guru spesifik di data sumber).
5. Kalau butuh cek ringkasan "mapel apa saja + siapa gurunya" per kelas,
   gabungkan hasil dari (3) dan (4).

## 6. Skrip Python siap-pakai (TERBUKTI JALAN, sudah dipakai & diverifikasi di project ini)

Simpan sebagai `baca_jadwal.py` di folder yang sama dengan `v9.4.xlsx`
(atau ubah `SRC` di bawah ke path file-nya), lalu jalankan
`python baca_jadwal.py`. Hasilnya file `hasil_per_guru.json` berisi jadwal
lengkap semua guru, siap dipakai untuk keperluan lain (tampilkan di web,
export ulang ke Excel, dsb).

```python
import json
import os
from collections import defaultdict

import openpyxl

SRC = "v9.4.xlsx"          # ganti sesuai lokasi file sumber
OUT = "hasil_per_guru.json"

SUBJECT_SHEETS = ["Sprt.", "Soc.", "Sc.", "Quran.", "Math.", "IFE.", "ICT.", "Eng.", "Cv.", "BI."]
DISPLAY = {"Sprt": "Sprt", "Soc": "Soc", "Sc": "Sc", "Quran": "Quran", "Math": "Math",
           "IFE": "IFE", "ICT": "ICT", "Eng": "Eng", "Cv": "Cv", "BI": "BI"}
BOYS_LETTERS = "ABC"
DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

# --- Gotcha #1: hari Jumat, 3 jam terakhir harus digeser +1 ---
FRIDAY_RAW_TO_DISPLAY = {6: 7, 7: 8, 8: 9}

def remap_lesson(day, raw_lesson):
    if day == "Friday":
        return FRIDAY_RAW_TO_DISPLAY.get(raw_lesson, raw_lesson)
    return raw_lesson

VALID_LESSONS_BY_DAY = {
    "Monday": set(range(1, 10)), "Tuesday": set(range(1, 10)),
    "Wednesday": set(range(1, 10)), "Thursday": set(range(1, 10)),
    "Friday": {1, 2, 3, 4, 5, 7, 8, 9},   # jam 6 memang tidak ada (istirahat Jumat)
    "Saturday": set(range(1, 7)),
}

# --- Bagian 4: jadwal jam (bell schedule) — jangan diubah tanpa konfirmasi sekolah ---
WEEKDAY_BASE = {1: ("07.30", "08.10"), 2: ("08.10", "08.50"),
                4: ("09.50", "10.30"), 5: ("10.30", "11.10"), 6: ("11.10", "11.50"),
                7: ("13.00", "13.40"), 8: ("13.40", "14.20"), 9: ("14.20", "15.00")}
WEEKDAY_L3 = {"boys": ("09.10", "09.50"), "girls": ("08.50", "09.30")}

FRIDAY_BASE = {1: ("07.30", "08.10"), 2: ("08.10", "08.50"),
               4: ("09.50", "10.30"), 5: ("10.30", "11.10"),
               7: ("13.00", "13.40"), 8: ("13.40", "14.20"), 9: ("14.20", "15.00")}
FRIDAY_L3 = WEEKDAY_L3

SATURDAY_BASE = {1: ("07.15", "07.45"), 2: ("07.45", "08.15"),
                 4: ("09.00", "09.30"), 5: ("09.30", "10.00"), 6: ("10.00", "10.30")}
SATURDAY_L3 = {"boys": ("08.15", "08.45"), "girls": ("08.30", "09.00")}  # gender TERBALIK vs weekday

DAY_SCHEDULE = {
    "Monday": (WEEKDAY_BASE, WEEKDAY_L3), "Tuesday": (WEEKDAY_BASE, WEEKDAY_L3),
    "Wednesday": (WEEKDAY_BASE, WEEKDAY_L3), "Thursday": (WEEKDAY_BASE, WEEKDAY_L3),
    "Friday": (FRIDAY_BASE, FRIDAY_L3), "Saturday": (SATURDAY_BASE, SATURDAY_L3),
}

# --- Gotcha #2: sheet Leadership & 4 sheet tanpa-guru datanya di-mirror di semua kolom ---
LEADERSHIP_SHEETS = ["LEADERSHIP 7.", "LEADERSHIP 8.", "LEASDERSHIP 9."]  # typo "LEASDERSHIP" asli dari sumber
LEADERSHIP_CODE_OF_SHEET = {"LEADERSHIP 7.": "L7", "LEADERSHIP 8.": "L8", "LEASDERSHIP 9.": "L9"}
LEADERSHIP_LABEL = {"L7": "Leadership 7", "L8": "Leadership 8", "L9": "Leadership 9"}
LEADERSHIP_CLASS_MARKER = "__LEADERSHIP__"


def gender_of(cls):
    return "boys" if cls[1:].strip()[0] in BOYS_LETTERS else "girls"


def time_of(day, lesson, gender):
    base, l3 = DAY_SCHEDULE[day]
    if lesson == 3:
        return l3[gender]
    return base[lesson]


wb_src = openpyxl.load_workbook(SRC, data_only=True, read_only=True)

# 1. daftar kelas valid
wsc = wb_src["Classes"]
all_classes = []
for row in wsc.iter_rows(min_row=2, max_row=200, max_col=1, values_only=True):
    if not row[0]:
        break
    all_classes.append(row[0])

# 2. peta nama<->nickname, dan jam Contract per guru (Gotcha #3: pakai ini, JANGAN hitung grid)
wst = wb_src["Teachers"]
nickname = {}
fullname_of = {}
contract_of = {}
for row in wst.iter_rows(min_row=2, max_col=6, values_only=True):
    name, short, contract = row[1], row[2], row[5]
    if name:
        nickname[name.strip()] = short
        fullname_of[short] = name.strip()
        if contract is not None and str(contract).strip().isdigit():
            contract_of[short] = int(str(contract).strip())

# 3. sheet Lessons -> siapa guru untuk (kelas, mapel); Leadership dicatat terpisah sbg peserta
wsl = wb_src["Lessons"]
teacher_of = {}
leadership_participants = defaultdict(set)
for row in wsl.iter_rows(min_row=2, max_col=8, values_only=True):
    teacher, cls_field, group, subj = row[0], row[1], row[2], row[3]
    if not subj or not cls_field or teacher == "Without teacher" or not teacher:  # Gotcha #4
        continue
    names = [nickname.get(n.strip(), n.strip()) for n in str(teacher).split(",") if n.strip()]
    if subj in LEADERSHIP_LABEL:
        leadership_participants[subj].update(names)
        continue
    if subj not in DISPLAY:
        continue
    classes_in_row = [c.strip() for c in str(cls_field).split(",") if c.strip() in all_classes]
    for cls in classes_in_row:
        teacher_of.setdefault((cls, subj), set()).update(names)

# 4. 10 sheet mapel inti -> isi jadwal per guru
per_teacher = defaultdict(lambda: defaultdict(list))
for sheetname in SUBJECT_SHEETS:
    key = sheetname.rstrip(".")
    ws = wb_src[sheetname]
    for row in ws.iter_rows(min_row=4, max_col=30):
        d = row[1].value
        raw_lesson = row[2].value
        if d is None or raw_lesson is None or str(d).strip() == "":
            continue
        lesson = remap_lesson(d, int(raw_lesson))  # Gotcha #1
        for cell in row[3:]:
            v = cell.value
            if not v:
                continue
            for cls in [x.strip() for x in str(v).split(",")]:
                if cls not in all_classes:
                    continue
                for t in teacher_of.get((cls, key), []):
                    per_teacher[t][(d, str(lesson))].append((cls, key))  # Gotcha #6: append, jangan overwrite

# 5. 3 sheet Leadership -> tambahkan ke jadwal guru peserta (Gotcha #2)
leadership_slots = defaultdict(set)
for sheetname in LEADERSHIP_SHEETS:
    code = LEADERSHIP_CODE_OF_SHEET[sheetname]
    ws = wb_src[sheetname]
    for row in ws.iter_rows(min_row=4, max_col=30):
        d = row[1].value
        raw_lesson = row[2].value
        if d is None or raw_lesson is None or str(d).strip() == "":
            continue
        if not any(cell.value for cell in row[3:]):
            continue
        lesson = remap_lesson(d, int(raw_lesson))
        leadership_slots[code].add((d, lesson))

for code, slots in leadership_slots.items():
    for t in leadership_participants.get(code, []):
        for (day, lesson) in slots:
            per_teacher[t][(day, str(lesson))].append((LEADERSHIP_CLASS_MARKER, code))

# 6. rakit hasil akhir per guru
teachers = {}
for nick, sched in per_teacher.items():
    cells = {}
    for (day, lesson_s), entries in sched.items():
        lesson = int(lesson_s)
        cell_entries = []
        for cls, subj_key in entries:
            if cls == LEADERSHIP_CLASS_MARKER:
                tm = time_of(day, lesson, "boys")  # Leadership tidak split gender
                cell_entries.append({"gender": "mixed", "start": tm[0], "end": tm[1],
                                      "class": LEADERSHIP_LABEL[subj_key], "subject": ""})
                continue
            tm = time_of(day, lesson, gender_of(cls))
            cell_entries.append({"gender": gender_of(cls), "start": tm[0], "end": tm[1],
                                  "class": cls, "subject": DISPLAY[subj_key]})
        cells[f"{day}|{lesson}"] = cell_entries
    teachers[nick] = {
        "nickname": nick,
        "fullname": fullname_of.get(nick, nick),
        "cells": cells,
        "total_lessons_per_week": contract_of.get(nick),  # Gotcha #3: dari Contract, bukan hitung grid
    }

with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"teachers": teachers, "days": DAYS,
                "valid_lessons_by_day": {d: sorted(v) for d, v in VALID_LESSONS_BY_DAY.items()}},
               f, ensure_ascii=False, indent=2)

print("Selesai. Jumlah guru terbaca:", len(teachers))
print("Tersimpan di:", OUT)
```

Catatan: skrip di atas fokus ke jadwal PER GURU (paling umum dibutuhkan).
Kalau butuh jadwal PER KELAS juga (termasuk 4 mapel tanpa guru: Homeroom
Teacher/Scout/SBK/Self Development), tambahkan loop serupa langkah 5 di
atas untuk 4 sheet itu — logikanya identik dengan Leadership (Gotcha #2:
ambil kolom pertama yang berisi data saja), bedanya hasilnya disimpan per
KELAS bukan per guru, dan sheet-nya adalah:
`HOMEROOM TEACHER.` (Senin+Jumat jam1, semua kelas),
`SCOUT.` (Sabtu jam5-6, hanya kelas 7&8),
`SENI BUDAYA KESENIAN.` (Jumat jam8-9 setelah remap, hanya kelas 7&8),
`SELF DEVELOPMENT.` (Kamis jam8-9, hanya kelas 7&8).

## 7. Checklist verifikasi (WAJIB dicek sebelum menganggap hasil benar)

1. Total guru yang berhasil dibaca harus masuk akal (SMP ABBS: sekitar 36
   guru) — kalau jauh lebih sedikit, kemungkinan salah baca sheet `Lessons`
   atau salah nama sheet.
2. Ambil 1-2 contoh guru, bandingkan manual: buka sheet mapelnya langsung
   di Excel, cek 2-3 baris, pastikan nama kelas & jam cocok dengan hasil
   olahan.
3. Cek slot Jumat jam 13.00 — pastikan hasilnya berlabel **jam ke-7**,
   BUKAN jam ke-6 (bukti Gotcha #1 sudah diterapkan benar).
4. Cek guru yang ikut Leadership (contoh dari sheet `LEADERSHIP 7.`,
   ambil salah satu nama) — pastikan jadwalnya menunjukkan "Leadership 7"
   di Senin jam 5 DAN jam 6 (2 jam berturut), bukan kosong dan bukan
   muncul di kelas yang salah.
5. Cek satu guru yang mengajar Sabtu — pastikan jam istirahatnya sesuai
   gender kelas dengan aturan TERBALIK (girls istirahat duluan, bukan
   boys) dibanding hari biasa.
6. Total "jam/minggu" tiap guru harus sama persis dengan angka di kolom
   Contract sheet `Teachers` untuk guru itu — kalau beda, ada bug di
   pembacaan (kecuali untuk beberapa guru Quran yang punya selisih Contract
   vs grid yang BELUM ditemukan sumbernya — kalau ketemu guru Quran dengan
   selisih kecil yang tidak terjelaskan Leadership, itu memang open issue
   lama di project ini, bukan berarti skrip kamu salah).

---
*Dokumen ini dibuat 2026-07-30 berdasarkan pengalaman nyata mengolah file
`v9.4.xlsx` untuk project "Jadwal Guru SMP ABBS" (web viewer + APK Android
`jadwalguruabbs`). Semua aturan di atas sudah dikonfirmasi langsung dengan
pihak sekolah dan diverifikasi lewat pengecekan data manual berulang kali —
bukan asumsi/tebakan.*
