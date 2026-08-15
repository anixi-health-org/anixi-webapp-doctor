import type { ConsultType, ConsultTypeSetting } from '../types';

export const CONSULT_TYPE_CATALOG: Record<
  ConsultType,
  { name: string; description: string; durationMinutes: number; bufferMinutes: number }
> = {
  initial: {
    name: 'New patient',
    description: 'First consultation for a new patient',
    durationMinutes: 45,
    bufferMinutes: 10,
  },
  'follow-up': {
    name: 'Follow-up',
    description: 'Review an existing patient',
    durationMinutes: 20,
    bufferMinutes: 5,
  },
  urgent: {
    name: 'Urgent consultation',
    description: 'Same-day or urgent care',
    durationMinutes: 30,
    bufferMinutes: 5,
  },
  procedure: {
    name: 'Procedure',
    description: 'Procedure or treatment visit',
    durationMinutes: 60,
    bufferMinutes: 15,
  },
  teleconsult: {
    name: 'Video consultation',
    description: 'Remote consultation',
    durationMinutes: 20,
    bufferMinutes: 5,
  },
  other: {
    name: 'Other',
    description: 'Other appointment type',
    durationMinutes: 30,
    bufferMinutes: 5,
  },
};

export const ALL_CONSULT_TYPES = Object.keys(CONSULT_TYPE_CATALOG) as ConsultType[];

/** Runtime defaults for legacy practices with no consultTypeSettings. */
export function defaultConsultTypeSettings(
  enabledTypes?: ConsultType[] | null,
): ConsultTypeSetting[] {
  const enabled =
    enabledTypes && enabledTypes.length > 0
      ? new Set(enabledTypes)
      : new Set<ConsultType>(['initial', 'follow-up']);

  return ALL_CONSULT_TYPES.map((type) => {
    const catalog = CONSULT_TYPE_CATALOG[type];
    return {
      id: type,
      type,
      name: catalog.name,
      description: catalog.description,
      enabled: enabled.has(type),
      durationMinutes: catalog.durationMinutes,
      bufferMinutes: catalog.bufferMinutes,
    };
  });
}

export function normalizeConsultTypeSettings(
  stored: ConsultTypeSetting[] | null | undefined,
  enabledTypes?: ConsultType[] | null,
): ConsultTypeSetting[] {
  const defaults = defaultConsultTypeSettings(enabledTypes);
  if (!stored || stored.length === 0) return defaults;

  const byType = new Map<ConsultType, ConsultTypeSetting>();
  for (const item of stored) {
    const type = (item.type || item.id) as ConsultType;
    if (!CONSULT_TYPE_CATALOG[type]) continue;
    byType.set(type, {
      id: type,
      type,
      name: item.name?.trim() || CONSULT_TYPE_CATALOG[type].name,
      description:
        item.description?.trim() || CONSULT_TYPE_CATALOG[type].description,
      enabled: item.enabled === true,
      durationMinutes:
        typeof item.durationMinutes === 'number' && item.durationMinutes > 0
          ? item.durationMinutes
          : CONSULT_TYPE_CATALOG[type].durationMinutes,
      bufferMinutes:
        typeof item.bufferMinutes === 'number' && item.bufferMinutes >= 0
          ? item.bufferMinutes
          : CONSULT_TYPE_CATALOG[type].bufferMinutes,
    });
  }

  return defaults.map((fallback) => byType.get(fallback.type) ?? fallback);
}

export function resolveConsultTypeSetting(
  settings: ConsultTypeSetting[] | null | undefined,
  consultType: ConsultType,
  enabledTypes?: ConsultType[] | null,
): ConsultTypeSetting | null {
  const normalized = normalizeConsultTypeSettings(settings, enabledTypes);
  return normalized.find((s) => s.type === consultType) ?? null;
}

export function validateConsultTypeSettingInput(
  input: Partial<ConsultTypeSetting> & { type: ConsultType },
): { ok: true; value: ConsultTypeSetting } | { ok: false; error: string } {
  if (!CONSULT_TYPE_CATALOG[input.type]) {
    return { ok: false, error: 'Unknown appointment type.' };
  }
  const duration =
    typeof input.durationMinutes === 'number' ? input.durationMinutes : NaN;
  const buffer =
    typeof input.bufferMinutes === 'number' ? input.bufferMinutes : NaN;
  if (!Number.isFinite(duration) || duration < 5 || duration > 480) {
    return { ok: false, error: 'Duration must be between 5 and 480 minutes.' };
  }
  if (!Number.isFinite(buffer) || buffer < 0 || buffer > 120) {
    return { ok: false, error: 'Buffer must be between 0 and 120 minutes.' };
  }
  const catalog = CONSULT_TYPE_CATALOG[input.type];
  return {
    ok: true,
    value: {
      id: input.type,
      type: input.type,
      name: (input.name ?? catalog.name).trim() || catalog.name,
      description:
        (input.description ?? catalog.description).trim() || catalog.description,
      enabled: input.enabled !== false,
      durationMinutes: duration,
      bufferMinutes: buffer,
    },
  };
}

export function enabledConsultTypes(
  settings: ConsultTypeSetting[] | null | undefined,
  legacyEnabled?: ConsultType[] | null,
): ConsultType[] {
  return normalizeConsultTypeSettings(settings, legacyEnabled)
    .filter((s) => s.enabled)
    .map((s) => s.type);
}
