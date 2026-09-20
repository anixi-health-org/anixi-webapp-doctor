const PROFILE_LANGUAGE_TO_BCP47: Record<string, string> = {
  english: 'en-ZA',
  afrikaans: 'af-ZA',
  zulu: 'zu-ZA',
  'isi zulu': 'zu-ZA',
  xhosa: 'xh-ZA',
  'isi xhosa': 'xh-ZA',
  sesotho: 'st-ZA',
  french: 'fr-FR',
  français: 'fr-FR',
  arabic: 'ar-SA',
  'moroccan darija': 'ar-SA',
  darija: 'ar-SA',
};

export function normalizeAyahVoiceLanguage(code?: string | null): string {
  if (!code || !String(code).trim()) {
    return 'en-ZA';
  }
  const raw = String(code).trim();
  const lower = raw.toLowerCase().replace(/_/g, '-');
  if (PROFILE_LANGUAGE_TO_BCP47[lower]) {
    return PROFILE_LANGUAGE_TO_BCP47[lower];
  }
  if (lower.startsWith('af')) return 'af-ZA';
  if (lower.startsWith('zu')) return 'zu-ZA';
  if (lower.startsWith('xh')) return 'xh-ZA';
  if (lower.startsWith('st')) return 'st-ZA';
  if (lower.startsWith('fr')) return 'fr-FR';
  if (lower.startsWith('ar')) return 'ar-SA';
  if (lower.startsWith('en')) return 'en-ZA';
  return 'en-ZA';
}

type PatientLanguageSource = {
  language?: string;
  preferredLanguage?: string;
  voiceLanguage?: string;
};

/** Patient chart language wins over clinician locale (matches backend priority 100). */
export function resolveAyahVoiceLanguage(params: {
  patientSnapshot?: PatientLanguageSource | null;
  fallback?: string;
}): string {
  const snapshot = params.patientSnapshot;
  const fromPatient =
    snapshot?.voiceLanguage || snapshot?.preferredLanguage || snapshot?.language;
  if (fromPatient) {
    return normalizeAyahVoiceLanguage(fromPatient);
  }
  return normalizeAyahVoiceLanguage(params.fallback ?? 'en-ZA');
}
