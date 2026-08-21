/** Practice letterhead lives in these Storage prefixes — never use them as a face photo. */
function decodedStoragePath(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

export function isPracticeLetterheadUrl(url: string | null | undefined): boolean {
  const raw = url?.trim();
  if (!raw) return false;
  const decoded = decodedStoragePath(raw);
  if (/doctors\/[^/]+\/branding\//.test(decoded)) return true;
  if (!decoded.includes('doctor-logos/')) return false;
  // Headshots are stored as doctor-logos/{id}/profile.jpg
  if (/doctor-logos\/[^/?#]+\/profile\./i.test(decoded)) return false;
  return true;
}

/**
 * Face photo for the portal header and patient-facing cards.
 * Practice logos/letterheads are excluded even if they were copied into profileImageUrl.
 */
export function resolveDoctorProfilePhotoUrl(
  profileImageUrl?: string | null,
  logoUrl?: string | null,
): string | undefined {
  const photo = profileImageUrl?.trim();
  if (!photo || isPracticeLetterheadUrl(photo)) return undefined;
  const logo = logoUrl?.trim();
  if (logo && photo === logo) return undefined;
  return photo;
}

/** Invoice letterhead: explicit logo, or a photo field that is actually a stored letterhead. */
export function resolvePracticeLogoUrl(
  logoUrl?: string | null,
  profileImageUrl?: string | null,
): string | undefined {
  const logo = logoUrl?.trim();
  if (logo) return logo;
  const photo = profileImageUrl?.trim();
  if (photo && isPracticeLetterheadUrl(photo)) return photo;
  return undefined;
}
