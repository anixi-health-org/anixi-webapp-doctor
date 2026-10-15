import type { PracticeRoom } from '../types';

export type RoomTypeKey = PracticeRoom['type'];

export const ROOM_TYPE_OPTIONS: {
  value: RoomTypeKey;
  label: string;
  description: string;
}[] = [
  {
    value: 'consult',
    label: 'Consult',
    description: 'Standard examination and follow-up visits.',
  },
  {
    value: 'procedure',
    label: 'Procedure',
    description: 'Minor procedures, treatment rooms, or surgery suites.',
  },
  {
    value: 'virtual',
    label: 'Virtual',
    description: 'Telehealth / video consult slots (no physical space).',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Waiting areas, phlebotomy, or shared spaces.',
  },
];

export function roomTypeDescription(type: RoomTypeKey): string {
  return ROOM_TYPE_OPTIONS.find((o) => o.value === type)?.description ?? '';
}

export function roomTypeBadgeClass(type: RoomTypeKey): string {
  switch (type) {
    case 'consult':
      return 'bg-emerald-50 text-emerald-800 ring-emerald-100';
    case 'procedure':
      return 'bg-violet-50 text-violet-800 ring-violet-100';
    case 'virtual':
      return 'bg-sky-50 text-sky-800 ring-sky-100';
    default:
      return 'bg-slate-50 text-slate-700 ring-slate-100';
  }
}
