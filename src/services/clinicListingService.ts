import type { Practice, PublicClinicListing } from '../types';

function mapListing(id: string, practice: Practice): PublicClinicListing {
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
    bhfPracticeNumber: practice.bhfPracticeNumber,
  };
}

export async function listPublicClinics(): Promise<PublicClinicListing[]> {
  // TODO: replace with a Django public-clinic listing endpoint once available.
  return [];
}

export async function getPublicClinic(
  practiceId: string,
): Promise<PublicClinicListing | null> {
  // TODO: replace with a Django public-clinic detail endpoint once available.
  return null;
}
