/**
 * Runtime flags for the Django vs Firebase cutover.
 * Firebase SDK has been removed from this app. Once REACT_APP_ANIXI_API_URL is set,
 * the whole app is Django-only: there is no Firebase code path left to enable.
 * Keep this module here so every guard in the codebase continues to resolve; the
 * functions always return the Django-only state regardless of env.
 */

export const API_BASE = process.env.REACT_APP_ANIXI_API_URL ?? '';

export function isDjangoApiEnabled(): boolean {
  return true;
}

export function isFirebaseDisabled(): boolean {
  return true;
}

export function isDjangoAuthOnly(): boolean {
  return true;
}

export function isFirebaseEnabled(): boolean {
  return false;
}
