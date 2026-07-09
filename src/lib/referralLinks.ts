export function buildPatientSignupLink(referralCode?: string): string {
  const base = `${window.location.origin}/register`;
  if (!referralCode) {
    return `${base}?role=patient`;
  }
  return `${base}?role=patient&ref=${encodeURIComponent(referralCode)}`;
}
