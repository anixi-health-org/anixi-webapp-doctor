/**
 * Runtime flags for the Django vs Firebase cutover.
 * Firebase SDK has been removed from this app. Once REACT_APP_ANIXI_API_URL is set,
 * the whole app is Django-only: there is no Firebase code path left to enable.
 * Keep this module here so every guard in the codebase continues to resolve; the
 * functions always return the Django-only state regardless of env.
 */

const envApiUrl = (process.env.REACT_APP_ANIXI_API_URL ?? '').trim();

export const API_BASE =
  envApiUrl || (process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:8000' : '');

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
