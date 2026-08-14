# Plan: Rewrite Schedule Import to Support aSc Timetables v9.4.xlsx Format

## Context

The current `ScheduleController::import()` reads a flat multi-sheet Excel where each sheet = one day, rows = periods, columns = classes. The user now has `v9.4.xlsx` files exported from **aSc Timetables** (SMP ABBS) with a completely different structure (see `Panduan Baca v9.4.xlsx (Jadwal aSc SMP ABBS).md`). The import logic must be fully rewritten.

## Current vs New Format

| Aspect | Current (Flat) | New (v9.4.xlsx) |
|--------|---------------|-----------------|
| Sheets | One per day, uniform layout | Classes, Teachers, Lessons, 10 subject sheets, 3 Leadership, 4 without-guru |
| Class list | Row 1 per sheet | `Classes` sheet (col B, rows 2+) |
| Teacher info | Embedded in cell ("Subject - Teacher") | `Teachers` sheet + `Lessons` sheet |
| Schedule grid | Rows=periods, Cols=days | Rows=days, Cols=classes per subject sheet |
| Period numbering | Row index - 2 | Col C (Lesson#), with Friday remap |
| Bell schedule | Not stored | Must be applied from Panduan Baca rules |
| Gender split | Not handled | Putra (A/B/C) vs Putri (D/E/F) have different jam-3 times |
| Friday | Has period 6 | Period 6 does NOT exist (istirahat Jumat) |
| Saturday | Not handled | 6 periods only, 30 min each, gender rules inverted |

## Changes Required

### 1. Rewrite `ScheduleController::import()` (app/Http/Controllers/Teacher/ScheduleController.php)

Replace the current flat-Excel parser with a v9.4.xlsx parser that:

- **Step 1**: Read `Classes` sheet → `$allClasses` (col B, rows 2+, stop at first empty)
- **Step 2**: Read `Teachers` sheet → build maps:
  - `$nicknameMap[nama_lengkap]` = nickname
  - `$contractOf[nickname]` = contract hours
  - `$fullnameOf[nickname]` = nama_lengkap
- **Step 3**: Read `Lessons` sheet → build `$teacherOfClassSubject` map:
  - Skip rows where teacher = "Without teacher" or empty (Gotcha #4)
  - For each row: `(kelas, mapel) -> set(nickname guru)`
  - Track Leadership participants separately: `$leadershipParticipants[grade]` = set(nickname)
- **Step 4**: For each of the 10 subject sheets (Sprt., Soc., Sc., Quran., Math., IFE., ICT., Eng., Cv., BI.):
  - Read rows starting row 4 (rows 1-3 are header)
  - Col B = day name (Monday..Saturday), Col C = Lesson# (raw)
  - Cols D+ = class codes (comma-separated if multiple)
  - Apply Gotcha #1: Friday Lesson# remap (6→7, 7→8, 8→9)
  - For each non-empty cell in cols D+:
    - Split comma-separated class codes
    - Look up teachers from `$teacherOfClassSubject`
    - Compute start_time/end_time from bell schedule (see §3)
    - Use `updateOrCreate` on `(class_name, day, period)`
- **Step 5**: For 3 Leadership sheets (LEADERSHIP 7., LEADERSHIP 8., LEASDERSHIP 9.):
  - Apply Gotcha #2: take only col D (first non-empty column), ignore duplicates in other cols
  - Determine grade from sheet name (7, 8, or 9)
  - For each slot, for each Leadership participant of that grade:
    - Store with `class_name = grade` (e.g., '7', '8', '9'), `subject = 'Leadership'`, `teacher = null`
    - This matches the JournalController query pattern: `class_name LIKE '7%' AND subject = 'Leadership'`
- **Step 6**: For 4 without-guru sheets (HOMEROOM TEACHER., SCOUT., SENI BUDAYA KESENIAN., SELF DEVELOPMENT.):
  - Apply Gotcha #2 (take first non-empty column only)
  - Store per-class schedule with subject label, no teacher
- **Step 7**: Total imported count, redirect with success/error

### 2. Add Bell Schedule Data (ScheduleController or new config)

Add the bell schedule from the Panduan Baca (section 4) as a PHP constant/array in the controller:

```php
// Senin-Kamis (weekday)
WEEKDAY_BELL = {
  1: ("07.30","08.10"), 2: ("08.10","08.50"),
  3_boys: ("09.10","09.50"), 3_girls: ("08.50","09.30"),
  4: ("09.50","10.30"), 5: ("10.30","11.10"), 6: ("11.10","11.50"),
  7: ("13.00","13.40"), 8: ("13.40","14.20"), 9: ("14.20","15.00"),
}
// Jumat (no period 6)
FRIDAY_BELL = { 1..5 same as weekday, 7..9 same as weekday }
// Sabtu (6 periods, 30 min, gender rules inverted)
SATURDAY_BELL = { ... }
```

A helper method `getBellTimes($day, $lesson, $gender)` returns `[$start, $end]`.

### 3. Subject Normalization Mapping

The aSc sheet names use short codes that must map to canonical subject names (consistent with `SubjectHelper` and existing `getMapelMapping()`):

| Sheet Name | Canonical Subject |
|------------|-------------------|
| Sprt. | SPORT |
| Soc. | Social |
| Sc. | Science |
| Quran. | Quran |
| Math. | Mathematics |
| IFE. | IFE |
| ICT. | ICT |
| Eng. | English |
| Cv. | Civics |
| BI. | Indonesian |
| LEADERSHIP 7./8./9. | Leadership |
| HOMEROOM TEACHER. | Homeroom Teacher |
| SCOUT. | Scout |
| SENI BUDAYA KESENIAN. | Seni Budaya Kesenian |
| SELF DEVELOPMENT. | Self Development |

### 4. Schedule Model Changes (app/Models/Schedule.php)

- **Remove or modify** the `saving` boot callback that auto-assigns teachers from `users.mapel`. With v9.4.xlsx, teacher assignments come explicitly from the `Lessons` sheet, so auto-assignment is unnecessary and could overwrite correct data.
- Keep `setSubjectDisplayAttribute` and `setTeacherAttribute` mutators (they normalize data correctly).
- Keep `normalizeSubject` and `getScheduleByClassAndDay` / `getAllClasses` helpers.

### 5. Schedule View Update (resources/views/schedule/index.blade.php)

Update the import section to inform users about the new format:
- Change the template description from "Gunakan template Excel" to "Upload file `v9.4.xlsx` dari aSc Timetables"
- Add a note listing the expected sheet names
- Keep the file upload and confirm checkbox

## Files to Modify

| File | Change |
|------|--------|
| `app/Http/Controllers/Teacher/ScheduleController.php` | Complete rewrite of `import()` method + add bell schedule helpers + subject mapping |
| `app/Models/Schedule.php` | Remove auto-teacher assignment boot callback |
| `app/Helpers/SubjectHelper.php` | Add aSc short-code variants to mapping |
| `resources/views/schedule/index.blade.php` | Update import section description |

## Files NOT Modified

- `routes/web.php` — routes stay the same
- Database schema — no migration changes needed

### 6. SubjectHelper Update (app/Helpers/SubjectHelper.php)

Add the aSc short-code variants to the normalization mapping so that `SubjectHelper::normalize()` can handle names like "Sprt", "Soc", "Sc", "Quran", "IFE", etc. directly.

### 7. Verification Checklist

1. Total guru terbaca from `Teachers` sheet matches expected count (~36)
2. Cek slot Jumat jam 13.00 — label **jam ke-7**, bukan ke-6 (Gotcha #1)
3. Cek guru Leadership — muncul di jadwal dengan label "Leadership" di kelas 7/8/9 (Gotcha #2)
4. Cek guru yang mengajar Sabtu — istirahat gender rules inverted (Sabtu rules)
5. Total "jam/minggu" tiap guru = angka Contract (Gotcha #3)
6. 4 mapel tanpa guru (HT/Scout/SBK/SD) muncul di jadwal per kelas tanpa nama guru
7. Cek satu guru dengan 2 kelas paralel di jam sama — disimpan sebagai list, bukan overwrite (Gotcha #6)
8. Bandingkan manual: buka sheet mapel di Excel, cek 2-3 baris vs hasil olahan

## Open Questions

1. **Does the user have a sample v9.4.xlsx file to test with?** — The plan assumes the format matches the Panduan Baca document exactly. A sample file is needed for validation.
2. **Should the old flat-format import be kept as a fallback?** — The plan replaces it entirely. If backward compatibility is needed, a format detection step should be added.
3. **How should `start_time`/`end_time` be stored?** — The bell schedule produces times like "07.30", "08.10". The `time` column in MySQL expects `HH:MM:SS` format. The plan stores them as `07:30:00`, `08:10:00` etc. (converting from dot notation to colon).

## Confirmed Answers (from user interview)

1. **Lessons sheet subject format**: User confirmed that the Lessons sheet uses short codes like "Sprt", "Soc", "Math" (without dots) — matching the Python reference script's `DISPLAY` dict keys.
2. **Leadership codes in Lessons sheet**: User confirmed Leadership subjects in the Lessons sheet use codes "L7", "L8", "L9" — matching the Python reference script.
3. **Teachers sheet columns**: Both Panduan Baca and Python reference agree: Column B = nama lengkap, Column C = nickname, Column F = Contract hours.
4. **Classes sheet column**: Panduan Baca says "kolom B" but Python reference reads column A (`max_col=1`). Trust the Python reference since it's verified — read column A.
