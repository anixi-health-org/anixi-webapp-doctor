/**
 * Consultation report using the History & Physical (H&P) structure —
 * the most widely taught clinical documentation format internationally
 * (outpatient-adapted from hospital H&P templates).
 */

export type ClinicalReportSectionId =
  | 'identification'
  | 'chiefComplaint'
  | 'pastMedicalHistory'
  | 'pastSurgicalHistory'
  | 'socialHistory'
  | 'familyHistory'
  | 'historyOfPresentIllness'
  | 'generalExamination'
  | 'physicalExamination'
  | 'assessment'
  | 'plan';

export type ClinicalReportSections = Record<ClinicalReportSectionId, string>;

export const CLINICAL_REPORT_FORMAT = 'hp-v1' as const;

export type ClinicalReportSectionDef = {
  id: ClinicalReportSectionId;
  title: string;
  hint?: string;
  placeholder: string;
  rows: number;
};

export const CLINICAL_REPORT_SECTIONS: ClinicalReportSectionDef[] = [
  {
    id: 'identification',
    title: '1. Patient identification',
    hint: 'Name, age, residence, medical aid, emergency contact',
    placeholder: 'Name, age, place of residence, medical aid, treating doctor, emergency contact…',
    rows: 3,
  },
  {
    id: 'chiefComplaint',
    title: '2. Chief complaint',
    hint: 'Reason for consultation in the patient’s own words',
    placeholder: 'Main symptoms or reason the patient presented today…',
    rows: 3,
  },
  {
    id: 'pastMedicalHistory',
    title: '3. Past medical history',
    hint: 'Conditions, allergies, chronic disease, current medications',
    placeholder: 'Known conditions, allergies, chronic diseases, current medications…',
    rows: 4,
  },
  {
    id: 'pastSurgicalHistory',
    title: '4. Past surgical history',
    placeholder: 'Previous operations and dates if known…',
    rows: 2,
  },
  {
    id: 'socialHistory',
    title: '5. Social history',
    hint: 'Smoking, alcohol, substance use, occupation',
    placeholder: 'Tobacco, alcohol, drugs, occupation, living situation…',
    rows: 3,
  },
  {
    id: 'familyHistory',
    title: '6. Family history',
    placeholder: 'Relevant family conditions (e.g. diabetes, hypertension, cardiac disease)…',
    rows: 3,
  },
  {
    id: 'historyOfPresentIllness',
    title: '7. History of present illness',
    hint: 'Onset, duration, severity, associated symptoms, relieving/aggravating factors',
    placeholder: 'When symptoms started, progression, severity, associated features, treatments tried…',
    rows: 5,
  },
  {
    id: 'generalExamination',
    title: '8. General examination',
    hint: 'Weight, height, BMI, temperature, blood pressure, SpO₂',
    placeholder: 'Weight (kg), height (m), BMI, temperature (°C), BP (mmHg), SpO₂ (%)…',
    rows: 3,
  },
  {
    id: 'physicalExamination',
    title: '9. Physical examination',
    hint: 'Cardiovascular, respiratory, abdomen, musculoskeletal, neurology, skin',
    placeholder: 'System-by-system findings. Document only what was examined…',
    rows: 5,
  },
  {
    id: 'assessment',
    title: '10. Assessment',
    hint: 'Clinical impression — syndromes, working diagnosis',
    placeholder: 'Patient X, aged Y, with history … presenting with … examination reveals …',
    rows: 4,
  },
  {
    id: 'plan',
    title: '11. Plan & discussion',
    hint: 'Investigations, treatment, follow-up, patient counselling',
    placeholder: 'Further tests, treatment plan, referrals, follow-up, patient education…',
    rows: 4,
  },
];

export function emptyClinicalReportSections(): ClinicalReportSections {
  return CLINICAL_REPORT_SECTIONS.reduce(
    (acc, section) => ({ ...acc, [section.id]: '' }),
    {} as ClinicalReportSections,
  );
}

export function buildIdentificationPrefill(params: {
  patientName?: string;
  patientAge?: string | number;
  medicalAid?: string;
  doctorName?: string;
}): string {
  const lines = [
    params.patientName ? `Name: ${params.patientName}` : null,
    params.patientAge != null && params.patientAge !== '' ? `Age: ${params.patientAge}` : null,
    params.medicalAid ? `Medical aid: ${params.medicalAid}` : null,
    params.doctorName ? `Treating clinician: ${params.doctorName}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

export function parseClinicalReportSections(
  content: string,
  metadata?: Record<string, string | number | boolean | null | undefined>,
): ClinicalReportSections {
  const base = emptyClinicalReportSections();
  const raw = metadata?.sections;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as Partial<ClinicalReportSections>;
      return { ...base, ...parsed };
    } catch {
      /* fall through */
    }
  }
  if (content.trim()) {
    return { ...base, assessment: content.trim() };
  }
  return base;
}

export function formatClinicalReportText(sections: ClinicalReportSections): string {
  return CLINICAL_REPORT_SECTIONS.map((section) => {
    const body = sections[section.id]?.trim();
    if (!body) return null;
    return `${section.title}\n${body}`;
  })
    .filter(Boolean)
    .join('\n\n');
}

export function clinicalReportHasContent(sections: ClinicalReportSections): boolean {
  return CLINICAL_REPORT_SECTIONS.some((section) => sections[section.id]?.trim());
}

export function clinicalReportFileName(patientName: string | undefined, ext: 'pdf' | 'docx'): string {
  const fileSafePatient = (patientName || 'patient')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const date = new Date().toISOString().split('T')[0];
  return `consultation-report-${fileSafePatient || 'patient'}-${date}.${ext}`;
}

export function sectionsFromAyahDraft(payload: Record<string, unknown>): ClinicalReportSections {
  const base = emptyClinicalReportSections();
  for (const section of CLINICAL_REPORT_SECTIONS) {
    const value = payload[section.id];
    if (typeof value === 'string' && value.trim()) {
      base[section.id] = value.trim();
    }
  }
  return base;
}
