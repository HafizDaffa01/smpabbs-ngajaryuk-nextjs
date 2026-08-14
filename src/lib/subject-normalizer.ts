/**
 * Subject Normalization Helper
 * Maps Indonesian/English subject name variants to canonical forms.
 */

const SUBJECT_MAPPING: Record<string, string[]> = {
  'ICT': ['ICT', 'KOMPUTER', 'COMPUTER', 'IT', 'TIK', 'INFORMATIKA'],
  'SPORT': ['SPORT', 'PJOK', 'OLGA', 'OLAHRAGA', 'PHE', 'SPRT'],
  'Civics': ['CIVIC', 'PKN', 'PPKN', 'CIVICS', 'CV'],
  'IFE': ['IFE', 'AGAMA', 'ISLAM', 'PAI', 'BP'],
  'Indonesian': ['BINDO', 'INDO', 'INDONESIA', 'INDONESIAN', 'B. INDO', 'BI'],
  'Science': ['IPA', 'SCIENCE', 'SC'],
  'Social': ['SOCIAL', 'IPS', 'SOC'],
  'TKA INDO': ['TKA INDO', 'TKAINDO', 'TI', 'TKAIND', 'TKA IND'],
  'TKA Mathematics': ['TM', 'TKA MATH', 'TKAMATH', 'TKAMAT', 'TKA MATHEMATICS'],
  'Quran': ['QURAN', 'QUR\'AN', 'AL-QURAN', 'AQ', 'QURAN'],
  'English': ['ENGLISH', 'INGGRIS', 'B. INGGRIS', 'ENG'],
  'Mathematics': ['MATH', 'MATHEMATICS', 'MATEMATIKA', 'MAT'],
  'Leadership': ['LEADERSHIP', 'PRAMUKA'],
  'Homeroom Teacher': ['HOMEROOM TEACHER'],
  'Scout': ['SCOUT'],
  'Seni Budaya Kesenian': ['SENI BUDAYA KESENIAN'],
  'Self Development': ['SELF DEVELOPMENT'],
}

export function normalizeSubject(subject: string | null | undefined): string | null {
  if (!subject) return null

  const upper = subject.toUpperCase().trim()

  // Exact match
  for (const [canonical, variants] of Object.entries(SUBJECT_MAPPING)) {
    if (variants.some((v) => v.toUpperCase() === upper)) {
      return canonical
    }
  }

  // Contains match (for variants > 2 chars)
  for (const [canonical, variants] of Object.entries(SUBJECT_MAPPING)) {
    if (variants.some((v) => v.length > 2 && upper.includes(v.toUpperCase()))) {
      return canonical
    }
  }

  return upper
}

export function getSubjectMapping(): Record<string, string[]> {
  return SUBJECT_MAPPING
}

export function normalizeMapel(mapel: unknown): Record<string, string | string[]> {
  if (!mapel) return {}

  if (typeof mapel === 'string') {
    try {
      mapel = JSON.parse(mapel)
    } catch {
      return {}
    }
  }

  if (Array.isArray(mapel)) {
    const normalized: Record<string, string | string[]> = {}
    for (const item of mapel) {
      if (typeof item === 'string') {
        const norm = normalizeSubject(item)
        if (norm) normalized[norm] = norm
      } else if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>
        const kelas = String(obj.kelas || obj.class_name || '')
        const mapelVal = String(obj.mapel || obj.subject || '')
        const norm = normalizeSubject(mapelVal)
        if (norm && kelas) {
          normalized[kelas] = norm
        }
      }
    }
    return normalized
  }

  if (typeof mapel === 'object' && mapel !== null) {
    const result: Record<string, string | string[]> = {}
    for (const [key, value] of Object.entries(mapel as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        result[key] = value.map((v) => normalizeSubject(String(v))).filter(Boolean) as string[]
      } else if (typeof value === 'string') {
        result[key] = normalizeSubject(value) || value
      }
    }
    return result
  }

  return {}
}
