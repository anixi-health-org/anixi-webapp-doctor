import type { Practice, PublicClinicListing } from '../types';
import {
  djangoGetPublicClinic,
  djangoListPublicClinics,
  isDjangoApiEnabled,
} from './djangoApiService';

export function mapListing(id: string, practice: Practice): PublicClinicListing {
  const listing = practice.publicListing;
  const primaryLocation = practice.locations?.[0];
  return {
    id,
    name: practice.tradingName || practice.name,
    slug: listing?.slug || id,
    tagline: listing?.tagline || '',
    description: listing?.description || '',
    city: listing?.city || primaryLocation?.address?.split(',')[0] || '',
    province: listing?.province || '',
    services: listing?.services || [],
    acceptsMedicalAid: listing?.acceptsMedicalAid ?? false,
    heroImageUrl: listing?.heroImageUrl,
    logoUrl: practice.logoUrl,
    bhfPracticeNumber: practice.bhfPracticeNumber,
  };
}

export function mapPublicClinicRow(row: Record<string, unknown>): PublicClinicListing {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? 'Clinic'),
    slug: String(row.slug ?? row.id ?? ''),
    tagline: row.tagline ? String(row.tagline) : undefined,
    description: row.description ? String(row.description) : undefined,
    city: row.city ? String(row.city) : undefined,
    province: row.province ? String(row.province) : undefined,
    services: Array.isArray(row.services) ? row.services.map(String) : [],
    acceptsMedicalAid: row.acceptsMedicalAid === true,
    heroImageUrl: row.heroImageUrl ? String(row.heroImageUrl) : undefined,
    logoUrl: row.logoUrl ? String(row.logoUrl) : undefined,
    bhfPracticeNumber: row.bhfPracticeNumber ? String(row.bhfPracticeNumber) : undefined,
  };
}

export async function listPublicClinics(): Promise<PublicClinicListing[]> {
  if (!isDjangoApiEnabled()) return [];
  const rows = await djangoListPublicClinics();
  return rows.map(mapPublicClinicRow);
}

export async function getPublicClinic(
  practiceId: string,
): Promise<PublicClinicListing | null> {
  if (!practiceId || !isDjangoApiEnabled()) return null;
  const row = await djangoGetPublicClinic(practiceId);
  return row ? mapPublicClinicRow(row) : null;
}
