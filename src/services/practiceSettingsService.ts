/**
 * Practice settings — Django API only (no Firestore fallbacks).
 */
import {
  normalizeConsultTypeSettings,
  validateConsultTypeSettingInput,
  CLINIC_CONSULT_TYPES,
  VIDEO_CONSULT_TYPE,
} from '../lib/consultTypeSettings';
import { isClinicianRole } from '../lib/practiceRoles';
import type {
  BookableBlock,
  BookingPolicy,
  ConsultType,
  ConsultTypeSetting,
  DayOfWeek,
  Practice,
  PracticeLocation,
  PracticeMember,
  PracticePermissions,
  SoftBlock,
} from '../types';
import * as djangoPractice from './practiceSettingsDjangoService';

export type PracticeSessionBundle = {
  practice: Practice;
  member: PracticeMember;
  bookingPolicy: BookingPolicy;
};

export const getPractice = djangoPractice.djangoGetPractice;

export const linkUserToPractice = async (_uid: string, _practiceId: string): Promise<void> => {
  // Django links practice membership server-side during provision/invite accept.
};

export const getPracticeByOwnerId = djangoPractice.djangoGetPracticeByOwnerId;

export const ensureOwnerMembership = async (
  practiceId: string,
  ownerId: string,
  options?: { isClinician?: boolean },
): Promise<PracticeMember> => {
  const existing = await djangoPractice.djangoGetPracticeMember(practiceId, ownerId);
  if (existing?.status === 'active') return existing;
  const provisioned = await djangoPractice.djangoProvisionPracticeForDoctor(ownerId);
  return provisioned.member;
};

export const ensureBookingPolicy = djangoPractice.djangoEnsureBookingPolicy;

export const resolvePracticeForUser = djangoPractice.djangoResolvePracticeForUser;

export const provisionPracticeForDoctor = djangoPractice.djangoProvisionPracticeForDoctor;

export const createPractice = async (
  ownerId: string,
  data: Pick<Practice, 'name' | 'timezone'> &
    Partial<Pick<Practice, 'locations' | 'consultTypes' | 'orgType' | 'tradingName' | 'bhfPracticeNumber'>>,
): Promise<string> => {
  const bundle = await djangoPractice.djangoProvisionPracticeForDoctor(ownerId, {
    name: data.name,
    orgType: data.orgType,
  });
  if (data.locations?.length || data.consultTypes?.length || data.tradingName || data.bhfPracticeNumber) {
    await djangoPractice.djangoUpdatePractice(bundle.practice.id, {
      locations: data.locations,
      consultTypes: data.consultTypes,
      tradingName: data.tradingName,
      bhfPracticeNumber: data.bhfPracticeNumber,
      timezone: data.timezone,
    });
  }
  return bundle.practice.id;
};

export const updatePractice = async (
  practiceId: string,
  updates: Partial<
    Pick<
      Practice,
      | 'name'
      | 'timezone'
      | 'locations'
      | 'rooms'
      | 'consultTypes'
      | 'consultTypeSettings'
      | 'orgType'
      | 'tradingName'
      | 'bhfPracticeNumber'
      | 'publicListing'
    >
  >,
): Promise<void> => {
  await djangoPractice.djangoUpdatePractice(practiceId, updates);
};

export const getResolvedConsultTypeSettings = async (
  practiceId: string,
): Promise<ConsultTypeSetting[]> => {
  const practice = await getPractice(practiceId);
  if (!practice) return normalizeConsultTypeSettings(undefined, ['initial', 'follow-up']);
  return normalizeConsultTypeSettings(practice.consultTypeSettings, practice.consultTypes);
};

export const upsertConsultTypeSetting = async (
  practiceId: string,
  input: Partial<ConsultTypeSetting> & { type: ConsultType },
): Promise<ConsultTypeSetting[]> => {
  const validated = validateConsultTypeSettingInput(input);
  if (!validated.ok) throw new Error(validated.error);

  const practice = await getPractice(practiceId);
  if (!practice) throw new Error('Practice not found.');

  const current = normalizeConsultTypeSettings(
    practice.consultTypeSettings,
    practice.consultTypes,
  );
  const next = current.map((item) =>
    item.type === validated.value.type ? validated.value : item,
  );
  if (!next.some((item) => item.type === validated.value.type)) {
    next.push(validated.value);
  }

  const enabledTypes = next.filter((s) => s.enabled).map((s) => s.type);
  await updatePractice(practiceId, {
    consultTypeSettings: next,
    consultTypes: enabledTypes,
  });

  const verified = await getResolvedConsultTypeSettings(practiceId);
  const saved = verified.find((s) => s.type === validated.value.type);
  if (
    !saved ||
    saved.enabled !== validated.value.enabled ||
    saved.durationMinutes !== validated.value.durationMinutes ||
    saved.bufferMinutes !== validated.value.bufferMinutes
  ) {
    throw new Error("Couldn't save appointment type.");
  }
  return verified;
};

export const setConsultTypeEnabled = async (
  practiceId: string,
  type: ConsultType,
  enabled: boolean,
): Promise<ConsultTypeSetting[]> => {
  const current = await getResolvedConsultTypeSettings(practiceId);
  const existing = current.find((s) => s.type === type);
  if (!existing) throw new Error('Appointment type not found.');
  return upsertConsultTypeSetting(practiceId, { ...existing, enabled });
};

export const getPracticeForUser = djangoPractice.djangoGetPracticeForUser;

export const getPracticeMember = djangoPractice.djangoGetPracticeMember;

export const listPracticeMembers = djangoPractice.djangoListPracticeMembers;

export const listPracticeClinicians = async (practiceId: string): Promise<PracticeMember[]> => {
  const { enrichPracticeMembers } = await import('./practiceMemberService');
  const members = await enrichPracticeMembers(await listPracticeMembers(practiceId));
  return members.filter(
    (m) => m.status === 'active' && (isClinicianRole(m.role) || m.isClinician === true),
  );
};

export const updatePracticeMember = async (
  practiceId: string,
  uid: string,
  updates: Partial<Pick<PracticeMember, 'role' | 'permissions' | 'status' | 'displayName'>>,
): Promise<void> => {
  void practiceId;
  void uid;
  void updates;
  throw new Error('Practice member updates are not yet available via Django API.');
};

export const deactivatePracticeMember = async (practiceId: string, uid: string): Promise<void> => {
  await updatePracticeMember(practiceId, uid, { status: 'inactive' });
};

export const addDelegate = async (
  _practiceId: string,
  _uid: string,
  _displayName: string,
  _email: string,
  _permissions: PracticePermissions,
): Promise<void> => {
  throw new Error('Use practice invites to add delegates.');
};

export const updateDelegatePermissions = async (
  _practiceId: string,
  _uid: string,
  _permissions: PracticePermissions,
): Promise<void> => {
  throw new Error('Delegate permission updates are not yet available via Django API.');
};

export const removeDelegate = async (practiceId: string, uid: string): Promise<void> => {
  await deactivatePracticeMember(practiceId, uid);
};

export const getBookableBlocks = djangoPractice.djangoGetBookableBlocksForPractice;

export const syncDoctorPublicAvailability = async (
  _practiceId: string,
  _doctorId: string,
): Promise<void> => {
  // Django bookable blocks are the source of truth; no mirror sync needed.
};

export const createBookableBlock = async (
  practiceId: string,
  block: Omit<BookableBlock, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> => djangoPractice.djangoCreateBookableBlockForPractice(practiceId, block);

export const updateBookableBlock = async (
  practiceId: string,
  blockId: string,
  updates: Partial<Omit<BookableBlock, 'id' | 'practiceId' | 'createdAt' | 'updatedAt'>>,
): Promise<void> => {
  await djangoPractice.djangoUpdateBookableBlockForPractice(practiceId, blockId, updates);
  if (updates.doctorId) {
    await syncDoctorPublicAvailability(practiceId, updates.doctorId);
  }
};

export const deleteBookableBlock = async (
  practiceId: string,
  blockId: string,
  doctorId?: string,
): Promise<void> => {
  await djangoPractice.djangoDeleteBookableBlockForPractice(practiceId, blockId);
  if (doctorId) {
    await syncDoctorPublicAvailability(practiceId, doctorId);
  }
};

function pickBookingLocation(
  locations: PracticeLocation[],
  settings: ConsultTypeSetting[],
): PracticeLocation {
  const clinicEnabled = settings.some(
    (s) => s.enabled && CLINIC_CONSULT_TYPES.includes(s.type),
  );
  const videoEnabled = settings.some((s) => s.enabled && s.type === VIDEO_CONSULT_TYPE);

  const clinicLocation = locations.find(
    (loc) => loc.type === 'clinic' || loc.type === 'hospital',
  );
  const virtualLocation = locations.find((loc) => loc.type === 'virtual');

  if (clinicEnabled && clinicLocation) return clinicLocation;
  if (videoEnabled && virtualLocation) return virtualLocation;
  return locations[0]!;
}

export const ensurePracticeBookingLocation = async (
  practiceId: string,
  typeSettings?: ConsultTypeSetting[],
): Promise<{ locationId: string; locations: PracticeLocation[]; created: boolean }> => {
  const practice = await getPractice(practiceId);
  if (!practice) throw new Error('Practice not found.');

  const settings =
    typeSettings && typeSettings.length > 0
      ? typeSettings
      : await getResolvedConsultTypeSettings(practiceId);

  if (practice.locations.length > 0) {
    const location = pickBookingLocation(practice.locations, settings);
    return { locationId: location.id, locations: practice.locations, created: false };
  }

  const clinicEnabled = settings.some(
    (s) => s.enabled && CLINIC_CONSULT_TYPES.includes(s.type),
  );
  const videoEnabled = settings.some((s) => s.enabled && s.type === VIDEO_CONSULT_TYPE);

  const newLocations: PracticeLocation[] = [];
  if (clinicEnabled || !videoEnabled) {
    newLocations.push({ id: crypto.randomUUID(), name: 'Main clinic', type: 'clinic' });
  }
  if (videoEnabled) {
    newLocations.push({ id: crypto.randomUUID(), name: 'Video consultation', type: 'virtual' });
  }
  if (newLocations.length === 0) {
    newLocations.push({ id: crypto.randomUUID(), name: 'Main clinic', type: 'clinic' });
  }

  await updatePractice(practiceId, { locations: newLocations });
  const location = pickBookingLocation(newLocations, settings);
  return { locationId: location.id, locations: newLocations, created: true };
};

export type DayAvailabilityPeriodInput = {
  startTime: string;
  endTime: string;
};

export const replaceDoctorDayAvailability = async (params: {
  practiceId: string;
  doctorId: string;
  dayOfWeek: DayOfWeek;
  periods: DayAvailabilityPeriodInput[];
  locationId: string;
  allowedConsultTypes: ConsultType[];
  slotDurationMinutes: number;
  bufferAfterMinutes: number;
}): Promise<BookableBlock[]> => {
  const {
    practiceId,
    doctorId,
    dayOfWeek,
    periods,
    locationId,
    allowedConsultTypes,
    slotDurationMinutes,
    bufferAfterMinutes,
  } = params;

  if (periods.length > 0) {
    if (!locationId) throw new Error('Add a location under Overview before saving availability.');
    if (allowedConsultTypes.length === 0) {
      throw new Error('Enable at least one appointment type before saving availability.');
    }
    if (slotDurationMinutes <= 0) {
      throw new Error('Appointment duration must be greater than zero.');
    }
  }

  const existing = (await getBookableBlocks(practiceId)).filter(
    (b) => b.doctorId === doctorId && b.dayOfWeek === dayOfWeek && b.active !== false,
  );

  for (const block of existing) {
    await djangoPractice.djangoDeleteBookableBlockForPractice(practiceId, block.id);
  }

  for (const period of periods) {
    await djangoPractice.djangoCreateBookableBlockForPractice(practiceId, {
      practiceId,
      doctorId,
      dayOfWeek,
      startTime: period.startTime,
      endTime: period.endTime,
      locationId,
      allowedConsultTypes,
      slotDurationMinutes,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes,
      active: true,
    });
  }

  await syncDoctorPublicAvailability(practiceId, doctorId);

  const verified = (await getBookableBlocks(practiceId)).filter(
    (b) => b.doctorId === doctorId && b.dayOfWeek === dayOfWeek && b.active !== false,
  );

  const sortedExpected = [...periods].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const sortedActual = [...verified].sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (sortedActual.length !== sortedExpected.length) {
    throw new Error('Availability save could not be verified. Please retry.');
  }
  for (let i = 0; i < sortedExpected.length; i += 1) {
    if (
      sortedActual[i].startTime !== sortedExpected[i].startTime ||
      sortedActual[i].endTime !== sortedExpected[i].endTime
    ) {
      throw new Error('Availability save could not be verified. Please retry.');
    }
  }

  return verified;
};

export const applyAppointmentDefaultsToDoctorBlocks = async (params: {
  practiceId: string;
  doctorId: string;
  slotDurationMinutes: number;
  bufferAfterMinutes: number;
  allowedConsultTypes: ConsultType[];
}): Promise<void> => {
  const blocks = (await getBookableBlocks(params.practiceId)).filter(
    (b) => b.doctorId === params.doctorId && b.active !== false,
  );
  for (const block of blocks) {
    await djangoPractice.djangoUpdateBookableBlockForPractice(params.practiceId, block.id, {
      slotDurationMinutes: params.slotDurationMinutes,
      bufferAfterMinutes: params.bufferAfterMinutes,
      allowedConsultTypes: params.allowedConsultTypes,
    });
  }
  await syncDoctorPublicAvailability(params.practiceId, params.doctorId);
};

export const getSoftBlocks = async (
  practiceId: string,
  from: Date,
  to: Date,
): Promise<SoftBlock[]> => {
  const all = await djangoPractice.djangoGetSoftBlocksForPractice(practiceId);
  return all.filter((b) => b.startAt >= from && b.startAt <= to);
};

export const getAllSoftBlocks = djangoPractice.djangoGetSoftBlocksForPractice;

export const syncDoctorPublicSoftBlocks = async (
  _practiceId: string,
  _doctorId: string,
): Promise<void> => {
  // Django soft blocks are the source of truth; no mirror sync needed.
};

export const createSoftBlock = async (
  practiceId: string,
  block: Omit<SoftBlock, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> => {
  const id = await djangoPractice.djangoCreateSoftBlockForPractice(practiceId, block);
  await syncDoctorPublicSoftBlocks(practiceId, block.doctorId);
  return id;
};

export const updateSoftBlock = async (
  practiceId: string,
  softBlockId: string,
  updates: Partial<Pick<SoftBlock, 'title' | 'category' | 'startAt' | 'endAt' | 'recurrence'>>,
  updatedBy: string,
): Promise<void> => {
  const blocks = await getAllSoftBlocks(practiceId);
  const doctorId = blocks.find((b) => b.id === softBlockId)?.doctorId;
  await djangoPractice.djangoUpdateSoftBlockForPractice(
    practiceId,
    softBlockId,
    updates,
    updatedBy,
  );
  if (doctorId) await syncDoctorPublicSoftBlocks(practiceId, doctorId);
};

export const deleteSoftBlock = async (practiceId: string, softBlockId: string): Promise<void> => {
  const blocks = await getAllSoftBlocks(practiceId);
  const doctorId = blocks.find((b) => b.id === softBlockId)?.doctorId;
  await djangoPractice.djangoDeleteSoftBlockForPractice(practiceId, softBlockId);
  if (doctorId) await syncDoctorPublicSoftBlocks(practiceId, doctorId);
};

export const getBookingPolicy = djangoPractice.djangoGetBookingPolicyForPractice;

export const updateBookingPolicy = async (
  practiceId: string,
  updates: Partial<Omit<BookingPolicy, 'practiceId' | 'updatedAt'>>,
): Promise<void> => {
  await djangoPractice.djangoUpdateBookingPolicyForPractice(practiceId, updates);
};
