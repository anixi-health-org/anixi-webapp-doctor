/**
 * Django API service — Phase 3 client migration layer for doctor webapp.
 * Set REACT_APP_ANIXI_API_URL to enable (e.g. http://localhost:8000 or https://api.anixihealth.com).
 *
 * Support, patient logs, queue arrival, and practice-calendar helpers are defined
 * here so the Firestore-only service files can be converted to call them. Where the
 * backend endpoint does not yet exist, the function is typed as present and the
 * service falls back to a localStorage stub.
 */
import { API_BASE, isDjangoApiEnabled as djangoEnabled } from '../lib/runtimeConfig';
import { parseCompanionStreamLine } from '../lib/companionStreamParse';
import {
  encodeMediaStorageKey,
  extractMediaStorageKey,
  isDirectBrowserMediaUrl,
} from '../lib/mediaUrls';
import type { PracticePermissions } from '../types';

type Envelope<T> = {
  success: boolean;
  data: T;
  error?: unknown;
  metadata?: Record<string, unknown> | null;
};

/** Flatten Django/DRF envelope errors into user-readable text. */
export function formatDjangoError(error: unknown, fallback = 'Request failed'): string {
  if (error == null) return fallback;
  if (typeof error === 'string') return error;
  if (typeof error !== 'object') return fallback;

  const record = error as Record<string, unknown>;
  if (typeof record.detail === 'string') return record.detail;

  const parts: string[] = [];
  for (const [field, value] of Object.entries(record)) {
    if (field === 'detail' || field === 'non_field_errors') continue;
    if (Array.isArray(value)) {
      const label = field === 'email' ? 'Email' : field === 'password' ? 'Password' : field;
      parts.push(`${label}: ${value.map(String).join(', ')}`);
    } else if (typeof value === 'string') {
      parts.push(value);
    }
  }

  const nonField = record.non_field_errors;
  if (Array.isArray(nonField)) {
    parts.unshift(nonField.map(String).join(', '));
  }

  return parts.length > 0 ? parts.join(' ') : fallback;
}

/** Map HTML/JSON parse failures (API down or CRA fallback) to a readable banner. */
export function userFacingLoadError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : fallback;
  if (
    /unexpected token/i.test(message) ||
    /DOCTYPE/i.test(message) ||
    /not valid JSON/i.test(message) ||
    /Failed to fetch/i.test(message) ||
    /NetworkError/i.test(message) ||
    /Could not reach the Anixi API/i.test(message) ||
    /API returned an error page/i.test(message)
  ) {
    return 'Could not reach the Anixi API. Confirm Django is running on http://127.0.0.1:8000.';
  }
  return message || fallback;
}

function enabled(): boolean {
  return djangoEnabled();
}

let refreshInFlight: Promise<string | null> | null = null;
let lastRefreshAt = 0;

async function refreshAccessToken(refresh: string): Promise<string | null> {
  if (!API_BASE) return null;
  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client': 'doctor-web' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const json = await readResponseJson<Envelope<{ access: string; refresh?: string }>>(res);
    if (!json.success || !json.data?.access) return null;
    localStorage.setItem('anixi_jwt_access', json.data.access);
    if (json.data.refresh) {
      localStorage.setItem('anixi_jwt_refresh', json.data.refresh);
    }
    return json.data.access;
  } catch (error) {
    console.warn('refreshAccessToken failed:', error);
    return null;
  }
}

function isJwtExpired(token: string, skewSeconds = 30): boolean {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return true;
    const payload = JSON.parse(
      atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
  } catch {
    return true;
  }
}

async function resolveAccessToken(forceRefresh = false): Promise<string> {
  const storedAccess = localStorage.getItem('anixi_jwt_access');
  const recentlyRefreshed = Date.now() - lastRefreshAt < 4000;
  if (
    storedAccess &&
    !isJwtExpired(storedAccess) &&
    (!forceRefresh || recentlyRefreshed)
  ) {
    return storedAccess;
  }

  if (!refreshInFlight) {
    const storedRefresh = localStorage.getItem('anixi_jwt_refresh');
    if (!storedRefresh) throw new Error('Not signed in');
    refreshInFlight = refreshAccessToken(storedRefresh).finally(() => {
      refreshInFlight = null;
    });
  }

  const refreshed = await refreshInFlight;
  if (refreshed) {
    lastRefreshAt = Date.now();
    return refreshed;
  }
  localStorage.removeItem('anixi_jwt_access');
  localStorage.removeItem('anixi_jwt_refresh');
  throw new Error('Not signed in');
}

async function authHeaders(forceRefresh = false): Promise<HeadersInit> {
  const token = await resolveAccessToken(forceRefresh);
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-Client': 'doctor-web',
  };
}

export function isDjangoApiEnabled(): boolean {
  return enabled();
}

export async function djangoCompanionStream(params: {
  message: string;
  context?: Record<string, unknown>;
  threadId?: string;
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/companion/stream/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: params.message,
      agentId: 'doctor-practice-partner',
      threadId: params.threadId,
      context: params.context,
    }),
    signal: params.signal,
  });
  if (!res.ok || !res.body) throw new Error(`Django stream failed: ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      for (const rawLine of part.split('\n')) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        const text = parseCompanionStreamLine(line);
        if (text) params.onChunk(text);
      }
    }
  }
  if (buffer.trim()) {
    for (const rawLine of buffer.split('\n')) {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      const text = parseCompanionStreamLine(line);
      if (text) params.onChunk(text);
    }
  }
}

export type DjangoVoiceTurnResult = {
  transcript: string;
  replyText: string;
  audioBase64?: string | null;
  mimeType?: string | null;
};

export async function djangoVoiceTurn(params: {
  audioBase64?: string;
  mimeType?: string;
  transcript?: string;
  languageCode?: string;
  threadId?: string;
  speakReply?: boolean;
  context?: Record<string, unknown>;
}): Promise<DjangoVoiceTurnResult> {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/companion/voice/turn/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...params,
      agentId: 'doctor-practice-partner',
    }),
  });
  return djangoJson<DjangoVoiceTurnResult>(res);
}

export type DjangoVoiceStreamEvent =
  | { type: 'transcript'; text: string }
  | { type: 'text-delta'; delta: string }
  | {
      type: 'audio';
      sentenceIndex: number;
      text: string;
      audioBase64: string;
      mimeType: string;
    }
  | { type: 'done'; replyText: string }
  | { type: 'error'; message: string };

export async function djangoVoiceStream(params: {
  audioBase64?: string;
  mimeType?: string;
  transcript?: string;
  languageCode?: string;
  threadId?: string;
  speakReply?: boolean;
  context?: Record<string, unknown>;
  onEvent: (event: DjangoVoiceStreamEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/companion/voice/stream/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      audioBase64: params.audioBase64,
      mimeType: params.mimeType,
      transcript: params.transcript,
      languageCode: params.languageCode,
      threadId: params.threadId,
      speakReply: params.speakReply,
      context: params.context,
      agentId: 'doctor-practice-partner',
    }),
    signal: params.signal,
  });
  if (!res.ok || !res.body) throw new Error(`Voice stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      for (const rawLine of part.split('\n')) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        const parsed = JSON.parse(payload) as DjangoVoiceStreamEvent;
        params.onEvent(parsed);
        if (parsed.type === 'error') {
          throw new Error(parsed.message);
        }
      }
    }
  }
}

export async function djangoSpeakText(params: {
  text: string;
  languageCode?: string;
}): Promise<{ audioBase64: string; mimeType: string }> {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/companion/speak/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return djangoJson<{ audioBase64: string; mimeType: string }>(res);
}

export async function djangoListDoctorDrafts() {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/companion/drafts/`, { headers });
  return (await djangoJson<unknown[]>(res)) ?? [];
}

export type DjangoDashboardWorkspace = {
  activeBoardId: string | null;
  boards: Array<{
    id: string;
    title: string;
    subtitle?: string;
    theme?: string;
    widgets: unknown[];
    createdBy?: string;
  }>;
};

export async function djangoGetDoctorDashboard(): Promise<DjangoDashboardWorkspace> {
  if (!enabled()) {
    return { activeBoardId: null, boards: [] };
  }
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/companion/dashboard/`, { headers });
  return (await djangoJson<DjangoDashboardWorkspace>(res)) ?? { activeBoardId: null, boards: [] };
}

export async function djangoSaveDoctorDashboard(
  workspace: DjangoDashboardWorkspace,
): Promise<DjangoDashboardWorkspace> {
  if (!enabled()) {
    throw new Error('Django API not configured');
  }
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/companion/dashboard/`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      activeBoardId: workspace.activeBoardId,
      boards: workspace.boards,
    }),
  });
  return (await djangoJson<DjangoDashboardWorkspace>(res)) ?? workspace;
}

export async function djangoResolveDoctorDraft(draftId: string, decision: 'approved' | 'rejected') {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/companion/drafts/${draftId}/resolve/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ decision }),
  });
  return djangoJson<{
    draftId: string;
    type: string;
    status: string;
    preview?: string;
    payload?: Record<string, unknown>;
    patientId?: string | null;
    appointmentId?: string | null;
    sent?: boolean;
  }>(res);
}

export async function djangoScribeTranscribe(audioBase64: string, mimeType: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/companion/scribe/transcribe/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ audioBase64, mimeType }),
  });
  const json = (await res.json()) as Envelope<{ transcript: string }>;
  return json.data?.transcript ?? '';
}

export async function djangoRegisterDevice(token: string, platform = 'web') {
  if (!enabled()) return;
  const headers = await authHeaders();
  await fetch(`${API_BASE}/api/v1/notifications/devices/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token, platform }),
  });
}

export async function djangoListNotifications() {
  if (!enabled() || !API_BASE) return [];
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api/v1/notifications/`, { headers });
    if (!res.ok) return [];
    return (
      (await djangoJson<
        Array<{
          id: string;
          type: string;
          title: string;
          body: string;
          appointmentId?: string;
          invoiceId?: string;
          read: boolean;
          createdAt: string;
        }>
      >(res)) ?? []
    );
  } catch (error) {
    console.warn('djangoListNotifications failed:', error);
    return [];
  }
}

export async function djangoCreateNotification(payload: {
  type: string;
  title: string;
  body: string;
  appointmentId?: string;
  invoiceId?: string;
  userId?: string;
}) {
  if (!enabled()) return;
  const headers = await authHeaders();
  await fetch(`${API_BASE}/api/v1/notifications/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}

export async function djangoSendTransactionalEmail(
  template:
    | 'doctor_onboarding_submitted'
    | 'delegate_invitation'
    | 'caregiver_invitation'
    | 'clinic_live_staff_reminder'
    | 'patient_download_invite',
  to: string,
  context: Record<string, string>,
) {
  if (!enabled()) return false;
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/notifications/email/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ template, to, context }),
  });
  const json = (await res.json()) as Envelope<{ sent: boolean }>;
  return Boolean(json.success && json.data?.sent);
}

export type DjangoPracticeInvite = {
  id: string;
  practiceId: string;
  practiceName: string;
  email: string;
  displayName?: string;
  role: string;
  permissions: Record<string, unknown>;
  invitedBy: string;
  invitedByName?: string;
  status: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
};

async function readResponseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Empty response from API');
  }
  const contentType = res.headers.get('content-type') || '';
  if (trimmed.startsWith('<') || contentType.includes('text/html')) {
    throw new Error(
      res.status >= 500
        ? 'The API returned an error page. Confirm Django is running and migrated.'
        : 'Could not reach the Anixi API. Confirm the backend is running on the configured URL.',
    );
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error('The API returned an unexpected response.');
  }
}

function formatApiDetail(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  if (Array.isArray(detail) && detail.length) {
    return detail.map((entry) => String(entry)).join(' ');
  }
  return null;
}

async function djangoEnvelope<T>(
  res: Response,
): Promise<{ data: T; metadata: Record<string, unknown> | null }> {
  if (res.status === 401) {
    await resolveAccessToken(true);
    throw new Error('Session refreshed. Retry request');
  }
  const json = await readResponseJson<Envelope<T> & { detail?: unknown }>(res);
  if (!json || typeof json !== 'object' || !('success' in json)) {
    const detail = formatApiDetail(json);
    if (res.status === 429) {
      throw new Error(detail || 'Too many requests. Please wait a moment and try again.');
    }
    if (detail) throw new Error(detail);
    throw new Error('The API returned an unexpected response.');
  }
  if (!json.success) throw new Error(formatDjangoError(json.error));
  const metadata =
    json.metadata && typeof json.metadata === 'object'
      ? json.metadata
      : null;
  return { data: json.data, metadata };
}

async function djangoJson<T>(res: Response): Promise<T> {
  const { data } = await djangoEnvelope<T>(res);
  return data;
}

export async function djangoUploadDocument(
  file: Blob,
  purpose: 'doctor-profile' | 'practice-logo' | 'medical-file' | 'appointment-document',
  filename: string,
): Promise<{ storageKey: string; url: string; mimeType: string; sizeBytes: number }> {
  if (!enabled()) throw new Error('Django API not configured');
  const token = await resolveAccessToken();
  const form = new FormData();
  form.append('file', file, filename);
  form.append('purpose', purpose);
  const res = await fetch(`${API_BASE}/api/v1/documents/upload/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Client': 'doctor-web',
    },
    body: form,
  });
  return djangoJson(res);
}

export async function djangoPatchDoctorProfile(
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/auth/doctor-profile/`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
  });
  return djangoJson(res);
}

export async function djangoCreatePracticeInvite(
  practiceId: string,
  input: {
    email: string;
    displayName?: string;
    role: string;
    permissions?: PracticePermissions;
    invitedByName?: string;
  },
): Promise<DjangoPracticeInvite> {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/invites/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  const json = (await res.json()) as Envelope<DjangoPracticeInvite>;
  if (!json.success) {
    throw new Error(formatDjangoError(json.error, 'Could not send invitation'));
  }
  return json.data;
}

export async function djangoListPracticeInvites(
  practiceId: string,
  status = 'pending',
): Promise<DjangoPracticeInvite[]> {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/invites/?status=${encodeURIComponent(status)}`,
    { headers },
  );
  return djangoJson<DjangoPracticeInvite[]>(res);
}

export async function djangoListMyPracticeInvites(
  status = 'pending',
): Promise<DjangoPracticeInvite[]> {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/invites/mine/?status=${encodeURIComponent(status)}`,
    { headers },
  );
  return djangoJson<DjangoPracticeInvite[]>(res);
}

export async function djangoPreviewPracticeInvite(
  practiceId: string,
  inviteId: string,
  token: string,
): Promise<DjangoPracticeInvite | null> {
  if (!enabled()) return null;
  const params = new URLSearchParams({ practiceId, inviteId, token });
  const res = await fetch(`${API_BASE}/api/v1/practices/invites/preview/?${params.toString()}`, {
    headers: { 'X-Client': 'doctor-web' },
  });
  if (res.status === 404) return null;
  return djangoJson<DjangoPracticeInvite>(res);
}

export async function djangoGetPracticeInvite(
  practiceId: string,
  inviteId: string,
): Promise<DjangoPracticeInvite | null> {
  if (!enabled()) return null;
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/invites/${encodeURIComponent(inviteId)}/`,
    { headers },
  );
  if (res.status === 404) return null;
  return djangoJson<DjangoPracticeInvite>(res);
}

export async function djangoResendPracticeInvite(practiceId: string, inviteId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/invites/${encodeURIComponent(inviteId)}/resend/`,
    { method: 'POST', headers },
  );
  return djangoJson<DjangoPracticeInvite>(res);
}

export async function djangoRevokePracticeInvite(practiceId: string, inviteId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/invites/${encodeURIComponent(inviteId)}/revoke/`,
    { method: 'POST', headers },
  );
  return djangoJson<DjangoPracticeInvite>(res);
}

export async function djangoNotifyClinicLiveInvites(practiceId: string): Promise<number> {
  if (!enabled()) return 0;
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/invites/clinic-live-notify/`,
    { method: 'POST', headers },
  );
  const data = await djangoJson<{ sent: number }>(res);
  return data.sent;
}

export async function djangoAcceptPracticeInvite(params: {
  practiceId: string;
  inviteId: string;
  token: string;
}) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/practices/invites/accept/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return djangoJson<Record<string, unknown>>(res);
}

function assertApiReachable(): void {
  if (!API_BASE) {
    throw new Error(
      'REACT_APP_ANIXI_API_URL is not set. For local dev use http://127.0.0.1:8000 in .env and restart npm run dev.',
    );
  }
}

async function djangoFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(
      `Could not reach the API at ${API_BASE}. Start Django (python manage.py runserver) and confirm .env points at your local backend.`,
    );
  }
}

export async function djangoRegister(params: {
  email: string;
  password: string;
  displayName: string;
  role: 'doctor' | 'patient' | 'caregiver' | 'staff';
  phoneNumber?: string;
  joinIntent?: string;
}) {
  if (!enabled()) throw new Error('Django API not configured');
  assertApiReachable();
  const res = await djangoFetch(`${API_BASE}/api/v1/auth/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client': 'doctor-web' },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      display_name: params.displayName,
      role: params.role,
      phone_number: params.phoneNumber ?? '',
      ...(params.joinIntent ? { joinIntent: params.joinIntent } : {}),
    }),
  });
  const json = (await res.json()) as Envelope<{
    user: Record<string, unknown>;
    tokens: { access: string; refresh: string };
  }>;
  if (!json.success) throw new Error(formatDjangoError(json.error, 'Registration failed'));
  localStorage.setItem('anixi_jwt_access', json.data.tokens.access);
  localStorage.setItem('anixi_jwt_refresh', json.data.tokens.refresh);
  return json.data;
}

export async function djangoDeleteAccount() {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/auth/me/delete/`, {
    method: 'DELETE',
    headers,
  });
  const json = (await res.json()) as Envelope<{ deleted: boolean }>;
  if (!json.success) throw new Error(String(json.error ?? 'Delete failed'));
  clearDjangoTokens();
}

export async function djangoLogin(email: string, password: string) {
  if (!enabled()) throw new Error('Django API not configured');
  assertApiReachable();
  const res = await djangoFetch(`${API_BASE}/api/v1/auth/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client': 'doctor-web' },
    body: JSON.stringify({ email, password }),
  });
  const json = (await res.json()) as Envelope<{
    user: Record<string, unknown>;
    tokens: { access: string; refresh: string };
  }>;
  if (!json.success) throw new Error(formatDjangoError(json.error, 'Login failed'));
  localStorage.setItem('anixi_jwt_access', json.data.tokens.access);
  localStorage.setItem('anixi_jwt_refresh', json.data.tokens.refresh);
  return json.data;
}

export async function djangoPasswordResetRequest(email: string) {
  if (!enabled()) throw new Error('Django API not configured');
  assertApiReachable();
  const res = await djangoFetch(`${API_BASE}/api/v1/auth/password-reset/request/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client': 'doctor-web' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  await djangoJson<{ sent: boolean }>(res);
}

export async function djangoPasswordResetConfirm(oobCode: string, newPassword: string) {
  if (!enabled()) throw new Error('Django API not configured');
  assertApiReachable();
  const res = await djangoFetch(`${API_BASE}/api/v1/auth/password-reset/confirm/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client': 'doctor-web' },
    body: JSON.stringify({ oob_code: oobCode, new_password: newPassword }),
  });
  return djangoJson<{ changed: boolean }>(res);
}

export async function djangoGetMe() {
  if (!enabled() || !API_BASE) return null;
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api/v1/auth/me/`, { headers });
    if (!res.ok) return null;
    return await djangoJson<Record<string, unknown>>(res);
  } catch {
    return null;
  }
}

export async function djangoPatchMe(patch: Record<string, unknown>) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/auth/me/`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
  });
  return djangoJson<Record<string, unknown>>(res);
}

export type AppointmentListQuery = {
  role?: 'doctor' | 'patient';
  practiceId?: string;
  fromDate?: string;
  toDate?: string;
  doctorId?: string;
  limit?: number;
};

export function buildAppointmentListQuery(
  opts: AppointmentListQuery | 'doctor' | 'patient' = 'doctor',
): string {
  const query = new URLSearchParams();
  if (typeof opts === 'string') {
    query.set('role', opts);
    return query.toString();
  }
  if (opts.practiceId) {
    query.set('practiceId', opts.practiceId);
  } else {
    query.set('role', opts.role || 'doctor');
  }
  if (opts.fromDate) query.set('fromDate', opts.fromDate);
  if (opts.toDate) query.set('toDate', opts.toDate);
  if (opts.doctorId) query.set('doctorId', opts.doctorId);
  if (opts.limit) query.set('limit', String(opts.limit));
  return query.toString();
}

export async function djangoListAppointments(
  roleOrOpts: 'doctor' | 'patient' | AppointmentListQuery = 'doctor',
) {
  if (!enabled() || !API_BASE) return [];
  try {
    const headers = await authHeaders();
    const qs = buildAppointmentListQuery(roleOrOpts);
    const res = await fetch(`${API_BASE}/api/v1/appointments/?${qs}`, { headers });
    if (!res.ok) return [];
    return (await djangoJson<Array<Record<string, unknown>>>(res)) ?? [];
  } catch (error) {
    console.warn('djangoListAppointments failed:', error);
    return [];
  }
}

export async function djangoCancelAppointment(appointmentId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/appointments/${appointmentId}/cancel/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  return djangoJson<{ cancelled: boolean }>(res);
}

export async function djangoPatchAppointment(
  appointmentId: string,
  patch: Record<string, unknown>,
) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/appointments/${appointmentId}/`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
  });
  return djangoJson<{ updated: boolean }>(res);
}

export type DjangoPanelPatient = {
  patientId: string;
  displayName?: string;
  email?: string;
  phoneNumber?: string;
  source?: string;
  practiceId?: string | null;
  status?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export async function djangoListPatientPanel() {
  if (!enabled() || !API_BASE) return [];
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/patients/panel/`, { headers });
  return (await djangoJson<DjangoPanelPatient[]>(res)) ?? [];
}

export async function djangoRemoveFromPanel(patientId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/patients/panel/`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ patientId }),
  });
  return djangoJson<{ removed: boolean; links: number }>(res);
}

export async function djangoListCareMessages() {
  if (!enabled() || !API_BASE) return [];
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/messaging/care-messages/`, { headers });
  if (!res.ok) return [];
  return (await djangoJson<Array<Record<string, unknown>>>(res)) ?? [];
}

export async function djangoSendCareMessage(params: {
  patientId: string;
  subject?: string;
  body: string;
}) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/messaging/care-messages/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoListCaregiverLinkedPatients() {
  if (!enabled() || !API_BASE) return [];
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/patients/caregiver/linked-patients/`, { headers });
  if (!res.ok) return [];
  return (await djangoJson<Array<Record<string, unknown>>>(res)) ?? [];
}

export async function djangoListSharingRequests(role: 'clinician' | 'patient' = 'clinician') {
  if (!enabled() || !API_BASE) return [];
  try {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/api/v1/patients/sharing/?role=${role}`, { headers });
    if (!res.ok) return [];
    return (await djangoJson<Array<Record<string, unknown>>>(res)) ?? [];
  } catch (error) {
    console.warn('djangoListSharingRequests failed:', error);
    return [];
  }
}

export async function djangoResolveSharing(requestId: string, decision: 'approved' | 'rejected') {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/patients/sharing/${requestId}/resolve/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ decision }),
  });
  return djangoJson<{ status: string }>(res);
}

export async function djangoListMyPractices() {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/practices/mine/`, { headers });
  return djangoJson<Array<Record<string, unknown>>>(res);
}

export async function djangoGetPracticeSession(): Promise<{
  practice: Record<string, unknown>;
  member: Record<string, unknown>;
  bookingPolicy: Record<string, unknown>;
} | null> {
  if (!enabled()) return null;
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/practices/mine/session/`, { headers });
  if (res.status === 404 || res.status === 403) return null;
  const body = await djangoJson<{
    practice: Record<string, unknown>;
    member: Record<string, unknown>;
    bookingPolicy: Record<string, unknown>;
  } | null>(res);
  return body;
}

export async function djangoListInvoices(practiceId?: string) {
  if (!enabled()) return [];
  try {
    const headers = await authHeaders();
    const qs = practiceId ? `?practiceId=${encodeURIComponent(practiceId)}` : '';
    const res = await fetch(`${API_BASE}/api/v1/billing/invoices/${qs}`, { headers });
    if (!res.ok) return [];
    return (await djangoJson<Array<Record<string, unknown>>>(res)) ?? [];
  } catch (error) {
    console.warn('djangoListInvoices failed:', error);
    return [];
  }
}

export async function djangoCreateInvoice(payload: Record<string, unknown>) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/billing/invoices/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoGetInvoice(invoiceId: string) {
  if (!enabled()) return null;
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/`,
    { headers },
  );
  if (!res.ok) return null;
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoPatchInvoice(
  invoiceId: string,
  patch: Record<string, unknown>,
) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/billing/invoices/${encodeURIComponent(invoiceId)}/`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    },
  );
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoListClaims(practiceId: string) {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/billing/claims/?practiceId=${encodeURIComponent(practiceId)}`,
    { headers },
  );
  return djangoJson<Array<Record<string, unknown>>>(res);
}

export async function djangoCreateClaim(payload: Record<string, unknown>) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/billing/claims/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoPatchClaim(claimId: string, patch: Record<string, unknown>) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/billing/claims/${encodeURIComponent(claimId)}/`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    },
  );
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoMarkConversationRead(conversationId: string) {
  if (!enabled()) return;
  const headers = await authHeaders();
  await fetch(
    `${API_BASE}/api/v1/messaging/conversations/${encodeURIComponent(conversationId)}/read/`,
    { method: 'POST', headers, body: JSON.stringify({}) },
  );
}

export async function djangoListRecordShares(role: 'doctor' | 'patient' = 'doctor') {
  if (!enabled() || !API_BASE) return [];
  try {
    const headers = await authHeaders();
    const res = await fetch(
      `${API_BASE}/api/v1/patients/record-shares/?role=${encodeURIComponent(role)}`,
      { headers },
    );
    if (!res.ok) return [];
    return (await djangoJson<Array<Record<string, unknown>>>(res)) ?? [];
  } catch (error) {
    console.warn('djangoListRecordShares failed:', error);
    return [];
  }
}

export async function djangoResolveRecordShare(
  shareId: string,
  decision: 'approved' | 'declined',
  reason?: string,
) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/patients/record-shares/${encodeURIComponent(shareId)}/resolve/`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ decision, reason }),
    },
  );
  return djangoJson<Record<string, unknown>>(res);
}

export type DjangoRosterImportRow = {
  patientId: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  mrn?: string | null;
  activationCode: string;
  status: string;
};

export async function djangoImportRoster(
  rows: Array<Record<string, unknown>>,
  practiceId?: string,
) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/patients/roster/import/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      rows,
      ...(practiceId ? { practiceId } : {}),
    }),
  });
  return djangoJson<{
    imported: number;
    skipped: number;
    practiceId?: string;
    clinicCode?: string;
    rows: DjangoRosterImportRow[];
  }>(res);
}

export type DjangoBulkImportJob = {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  processedRows: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{ chunk?: string; message: string }>;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

/** Upload a CSV file for batched Celery processing. Returns a job to poll. */
export async function djangoImportRosterCsv(
  file: File,
  practiceId: string,
): Promise<{ jobId: string; totalRows: number; skippedParse: number; status: string }> {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  delete (headers as Record<string, string>)['Content-Type'];

  const form = new FormData();
  form.append('file', file);
  form.append('practiceId', practiceId);

  const res = await fetch(`${API_BASE}/api/v1/patients/roster/import-csv/`, {
    method: 'POST',
    headers,
    body: form,
  });
  return djangoJson<{ jobId: string; totalRows: number; skippedParse: number; status: string }>(res);
}

/** Poll a bulk import job's progress. */
export async function djangoGetImportJobStatus(jobId: string): Promise<DjangoBulkImportJob> {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/patients/roster/import-jobs/${encodeURIComponent(jobId)}/`, { headers });
  return djangoJson<DjangoBulkImportJob>(res);
}

/** Get the results CSV download URL for a completed job. */
export function djangoImportJobResultsCsvUrl(jobId: string): string {
  return `${API_BASE}/api/v1/patients/roster/import-jobs/${encodeURIComponent(jobId)}/results.csv`;
}

export async function djangoRotateClinicCode(practiceId: string): Promise<{ clinicCode: string; practiceName: string }> {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/clinic-code/rotate/`, {
    method: 'POST',
    headers,
  });
  return djangoJson<{ clinicCode: string; practiceName: string }>(res);
}

export type DjangoPracticePatient = {
  patientId: string;
  displayName: string;
  email: string;
  phoneNumber?: string;
  practiceId?: string | null;
  assignedDoctorId?: string | null;
  activationCode?: string | null;
  clinicCode?: string | null;
  status?: string;
  source?: string;
  isActive?: boolean;
  dateOfBirth?: string | null;
  gender?: string;
  idNumber?: string;
  medicalAidName?: string;
  medicalAidNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  address?: string;
  bloodGroup?: string;
  weight?: string;
  allergies?: string[];
  previousHealthConditions?: string[];
  previousSurgeries?: string[];
  previousMedications?: string[];
  preferredHospital?: string;
  language?: string;
  maritalStatus?: string;
  occupation?: string;
  employmentStatus?: string;
  planOption?: string;
  hasCaregiver?: boolean;
  caregiverEmail?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PracticePatientListQuery = {
  q?: string;
  page?: number;
  limit?: number;
};

export type PracticePatientListResult = {
  rows: DjangoPracticePatient[];
  total: number;
  page: number;
  limit: number;
};

export async function djangoListPracticePatients(
  practiceId: string,
  options?: PracticePatientListQuery,
): Promise<PracticePatientListResult> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 50;
  if (!enabled()) {
    return { rows: [], total: 0, page, limit };
  }
  const headers = await authHeaders();
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (options?.q?.trim()) params.set('q', options.q.trim());
  const res = await fetch(
    `${API_BASE}/api/v1/patients/practice/${encodeURIComponent(practiceId)}/?${params}`,
    { headers },
  );
  const { data, metadata } = await djangoEnvelope<DjangoPracticePatient[]>(res);
  const rows = Array.isArray(data) ? data : [];
  return {
    rows,
    total: Number(metadata?.total ?? rows.length) || 0,
    page: Number(metadata?.page ?? page) || page,
    limit: Number(metadata?.limit ?? limit) || limit,
  };
}

export async function djangoAssignPracticePatient(
  practiceId: string,
  patientId: string,
  assignedDoctorId: string | null,
) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/patients/practice/${encodeURIComponent(practiceId)}/${encodeURIComponent(patientId)}/assign/`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ assignedDoctorId: assignedDoctorId ?? '' }),
    },
  );
  return djangoJson<DjangoPracticePatient>(res);
}

export async function djangoBulkAssignPracticePatients(
  practiceId: string,
  payload: {
    assignedDoctorId: string | null;
    patientIds?: string[];
    allMatching?: boolean;
    q?: string;
  },
) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/patients/practice/${encodeURIComponent(practiceId)}/assign/`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        assignedDoctorId: payload.assignedDoctorId ?? '',
        patientIds: payload.patientIds ?? [],
        allMatching: Boolean(payload.allMatching),
        q: payload.q ?? '',
      }),
    },
  );
  return djangoJson<{ assigned: number; assignedDoctorId: string | null }>(res);
}

export async function djangoGetPracticePatientAccount(practiceId: string, patientId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/patients/practice/${encodeURIComponent(practiceId)}/${encodeURIComponent(patientId)}/`,
    { headers },
  );
  return djangoJson<DjangoPracticePatient>(res);
}

export async function djangoPatchPracticePatientAccount(
  practiceId: string,
  patientId: string,
  patch: Record<string, unknown>,
) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/patients/practice/${encodeURIComponent(practiceId)}/${encodeURIComponent(patientId)}/`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    },
  );
  return djangoJson<DjangoPracticePatient>(res);
}

export async function djangoListPharmacyOrders() {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/marketplace/pharmacy-orders/`, { headers });
  if (!res.ok) return [];
  return djangoJson<Array<Record<string, unknown>>>(res);
}

export async function djangoCreatePharmacyOrder(payload: Record<string, unknown>) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/marketplace/pharmacy-orders/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoListClinicAuditLogs(practiceId: string, limit = 100) {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/audit-logs/?limit=${limit}`,
    { headers },
  );
  if (!res.ok) return [];
  return djangoJson<Array<Record<string, unknown>>>(res);
}

export async function djangoCreateClinicAuditLog(
  practiceId: string,
  payload: Record<string, unknown>,
) {
  if (!enabled()) return;
  const headers = await authHeaders();
  await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/audit-logs/`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    },
  );
}

export async function djangoMarkNotificationRead(notificationId: string) {
  if (!enabled()) return;
  const headers = await authHeaders();
  await fetch(`${API_BASE}/api/v1/notifications/${notificationId}/read/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
}

export function clearDjangoTokens() {
  localStorage.removeItem('anixi_jwt_access');
  localStorage.removeItem('anixi_jwt_refresh');
}

const clinicOnboardingKey = (userId: string) => `anixi_clinic_onboarding_complete_${userId}`;

export async function markClinicOnboardingComplete(userId: string) {
  localStorage.setItem(clinicOnboardingKey(userId), '1');
  if (!enabled()) return;
  try {
    await djangoPatchMe({ clinicOnboardingComplete: true });
  } catch (error) {
    console.warn('markClinicOnboardingComplete failed to persist:', error);
  }
}

export function readClinicOnboardingComplete(userId: string): boolean {
  return localStorage.getItem(clinicOnboardingKey(userId)) === '1';
}

export async function djangoFetchTeleconsultToken(appointmentId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/appointments/${appointmentId}/teleconsult/token/`,
    { method: 'POST', headers, body: JSON.stringify({}) },
  );
  return djangoJson<{ serverUrl: string; token: string; roomName: string }>(res);
}

export async function djangoListConversations() {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/messaging/conversations/`, { headers });
  return djangoJson<Array<Record<string, unknown>>>(res);
}

export async function djangoGetOrCreateConversation(params: {
  patientId: string;
  clinicianId?: string;
}) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/messaging/conversations/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoListMessages(conversationId: string) {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/messaging/conversations/${conversationId}/messages/`,
    { headers },
  );
  return djangoJson<Array<Record<string, unknown>>>(res);
}

export async function djangoSendMessage(conversationId: string, text: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/messaging/conversations/${conversationId}/messages/`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: text }),
    },
  );
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoCreateSharingRequest(params: {
  clinicianId: string;
  patientId?: string;
  message?: string;
}) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/patients/sharing/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  return djangoJson<{ id: string }>(res);
}

export async function djangoFetchPractice(practiceId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/practices/${practiceId}/`, { headers });
  return djangoJson<Record<string, unknown>>(res);
}

async function djangoPublicJson<T>(res: Response): Promise<T> {
  const json = await readResponseJson<Envelope<T>>(res);
  if (!json || typeof json !== 'object' || !('success' in json)) {
    throw new Error('The API returned an unexpected response.');
  }
  if (!json.success) throw new Error(formatDjangoError(json.error));
  return json.data;
}

export async function djangoListPublicClinics(): Promise<Array<Record<string, unknown>>> {
  if (!enabled() || !API_BASE) return [];
  const res = await fetch(`${API_BASE}/api/v1/practices/public/`, {
    headers: { 'X-Client': 'doctor-web' },
  });
  return djangoPublicJson<Array<Record<string, unknown>>>(res);
}

export async function djangoGetPublicClinic(
  practiceId: string,
): Promise<Record<string, unknown> | null> {
  if (!enabled() || !API_BASE || !practiceId) return null;
  const res = await fetch(
    `${API_BASE}/api/v1/practices/public/${encodeURIComponent(practiceId)}/`,
    { headers: { 'X-Client': 'doctor-web' } },
  );
  if (res.status === 404) return null;
  return djangoPublicJson<Record<string, unknown>>(res);
}

export async function djangoPatchPractice(practiceId: string, patch: Record<string, unknown>) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/practices/${practiceId}/`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
  });
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoFetchPracticeMembers(practiceId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/practices/${practiceId}/members/`, { headers });
  return djangoJson<Array<Record<string, unknown>>>(res);
}

export async function djangoGetPracticeMemberAccount(practiceId: string, userId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/members/${encodeURIComponent(userId)}/`,
    { headers },
  );
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoPatchPracticeMember(
  practiceId: string,
  userId: string,
  patch: Record<string, unknown>,
) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/members/${encodeURIComponent(userId)}/`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    },
  );
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoDeactivatePracticeMember(practiceId: string, userId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/members/${encodeURIComponent(userId)}/`,
    { method: 'DELETE', headers },
  );
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoGetPracticeStats(practiceId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/stats/`,
    { headers },
  );
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoGetPracticeScheduleMap(practiceId: string) {
  if (!enabled()) return { daySchedules: {}, weeklyHours: {} };
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/schedule/`,
    { headers },
  );
  return djangoJson<{
    daySchedules?: Record<string, Record<string, unknown>>;
    weeklyHours?: Record<string, unknown>;
  }>(res);
}

export async function djangoGetBookingPolicy(practiceId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/practices/${practiceId}/booking-policy/`, { headers });
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoUpdateBookingPolicy(practiceId: string, patch: Record<string, unknown>) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/practices/${practiceId}/booking-policy/`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patch),
  });
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoGetBookableBlocks(practiceId: string, doctorId?: string) {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const qs = doctorId ? `?doctorId=${encodeURIComponent(doctorId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/practices/${practiceId}/bookable-blocks/${qs}`, { headers });
  return djangoJson<Array<Record<string, unknown>>>(res);
}

export async function djangoGetSoftBlocks(practiceId: string, doctorId?: string) {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const qs = doctorId ? `?doctorId=${encodeURIComponent(doctorId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/practices/${practiceId}/soft-blocks/${qs}`, { headers });
  return djangoJson<Array<Record<string, unknown>>>(res);
}

export async function djangoProvisionPractice(options?: Record<string, unknown>) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/practices/provision/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(options ?? {}),
  });
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoChangePassword(currentPassword: string, newPassword: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/auth/change-password/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return djangoJson<{ changed: boolean }>(res);
}

export async function djangoEndTeleconsult(appointmentId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/appointments/${appointmentId}/teleconsult/end/`,
    { method: 'POST', headers, body: JSON.stringify({}) },
  );
  return djangoJson<{ ended: boolean }>(res);
}

export async function djangoCreateBookableBlock(
  practiceId: string,
  payload: Record<string, unknown>,
) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/bookable-blocks/`,
    { method: 'POST', headers, body: JSON.stringify(payload) },
  );
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoUpdateBookableBlock(
  practiceId: string,
  blockId: string,
  patch: Record<string, unknown>,
) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/bookable-blocks/${encodeURIComponent(blockId)}/`,
    { method: 'PATCH', headers, body: JSON.stringify(patch) },
  );
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoDeleteBookableBlock(practiceId: string, blockId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/bookable-blocks/${encodeURIComponent(blockId)}/`,
    { method: 'DELETE', headers },
  );
  return djangoJson<{ deleted: boolean }>(res);
}

export async function djangoCreateSoftBlock(
  practiceId: string,
  payload: Record<string, unknown>,
) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/soft-blocks/`,
    { method: 'POST', headers, body: JSON.stringify(payload) },
  );
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoDeleteSoftBlock(practiceId: string, blockId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/soft-blocks/${encodeURIComponent(blockId)}/`,
    { method: 'DELETE', headers },
  );
  return djangoJson<{ deleted: boolean }>(res);
}

export async function djangoGetPatientChart(patientId: string) {
  if (!enabled()) return null;
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/patients/${encodeURIComponent(patientId)}/chart/`,
    { headers },
  );
  if (!res.ok) return null;
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoListMedicalFiles(patientId: string) {
  if (!enabled() || !API_BASE) return [];
  try {
    const headers = await authHeaders();
    const res = await fetch(
      `${API_BASE}/api/v1/documents/medical-files/?patientId=${encodeURIComponent(patientId)}`,
      { headers },
    );
    if (!res.ok) return [];
    return (await djangoJson<Array<Record<string, unknown>>>(res)) ?? [];
  } catch (error) {
    console.warn('djangoListMedicalFiles failed:', error);
    return [];
  }
}

export async function djangoAutoMatchRoster() {
  if (!enabled()) return { matched: false };
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/patients/roster/auto-match/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  return djangoJson<{ matched: boolean }>(res);
}

export async function djangoBookAppointment(payload: Record<string, unknown>) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/appointments/book/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  return djangoJson<{ appointmentId: string }>(res);
}

export async function djangoListWellnessProviders(category?: string) {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const qs = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/community/wellness-providers/${qs}`, { headers });
  return djangoJson<Array<Record<string, unknown>>>(res);
}

export async function djangoListMyEmployers() {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/employers/mine/`, { headers });
  return djangoJson<Array<Record<string, unknown>>>(res);
}

export async function djangoCreateEmployer(input: {
  name: string;
  industry?: string;
  city?: string;
  province?: string;
  employeeTarget?: number;
}) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/employers/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoListEmployerEnrollments(employerId: string) {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/employers/${encodeURIComponent(employerId)}/enrollments/`,
    { headers },
  );
  if (!res.ok) return [];
  return djangoJson<Array<Record<string, unknown>>>(res);
}

export async function djangoAddEmployerEnrollment(
  employerId: string,
  input: { email: string; displayName?: string },
) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/employers/${encodeURIComponent(employerId)}/enrollments/`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    },
  );
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoFetchDocumentUrl(
  storageKey: string,
  forceRefresh = false,
): Promise<string | null> {
  if (!enabled() || !storageKey) return null;
  const token = await resolveAccessToken(forceRefresh);
  const key = extractMediaStorageKey(storageKey) || storageKey;
  return `${API_BASE}/api/v1/documents/media/${encodeMediaStorageKey(key)}/?access=${encodeURIComponent(token)}`;
}

/** Open a protected document in a new tab with a fresh access token. */
export async function djangoOpenMediaDocument(
  urlOrKey: string | null | undefined,
): Promise<void> {
  const trimmed = urlOrKey?.trim();
  if (!trimmed) return;

  const key = extractMediaStorageKey(trimmed) ?? trimmed;
  const url = await djangoFetchDocumentUrl(key, true);
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Extract the storage key from an API media URL (with or without ?access= token). */
export function djangoMediaUrlToStorageKey(
  url: string | null | undefined,
): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  return extractMediaStorageKey(trimmed) ?? trimmed;
}

/** Append JWT access token to API media URLs so `<img>` tags can load protected files. */
export async function djangoResolveMediaUrl(
  url: string | null | undefined,
): Promise<string | undefined> {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (isDirectBrowserMediaUrl(trimmed)) return trimmed;

  const key = extractMediaStorageKey(trimmed);
  if (!key) return trimmed;
  return (await djangoFetchDocumentUrl(key)) ?? trimmed;
}

export async function enrichDoctorMediaUrls<
  T extends { role: string; logoUrl?: string; profileImageUrl?: string },
>(user: T): Promise<T> {
  if (user.role !== 'doctor') return user;
  return {
    ...user,
    logoUrl: await djangoResolveMediaUrl(user.logoUrl),
    profileImageUrl: await djangoResolveMediaUrl(user.profileImageUrl),
  };
}

// --- Support requests -------------------------------------------------------

export async function djangoCreateSupportRequest(params: {
  doctorId: string;
  subject: string;
  message: string;
}) {
  if (!enabled()) return { id: 'support-placeholder' };
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/support/`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Support request failed: ${res.status}`);
  return djangoJson<{ id: string }>(res);
}

export async function djangoListSupportRequests(
  doctorId: string,
  limit = 50,
) {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/support/?doctorId=${encodeURIComponent(doctorId)}&limit=${limit}`,
    { headers },
  );
  if (!res.ok) return [];
  return djangoJson<Array<Record<string, unknown>>>(res);
}

// --- Patient chart / logs ---------------------------------------------------

export async function djangoGetPatientDayLogs(
  patientId: string,
  date: string,
) {
  if (!enabled()) return null;
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/patients/${encodeURIComponent(patientId)}/logs/${encodeURIComponent(date)}/`,
    { headers },
  );
  if (!res.ok) return null;
  return djangoJson<Record<string, unknown>>(res);
}

export type DjangoAdherenceRecord = {
  id: string;
  userId?: string;
  type?: string;
  itemType?: string;
  itemId?: string;
  medicationName?: string;
  dosage?: string;
  dosageUnit?: string;
  scheduledTime?: string;
  scheduledFor?: string;
  status?: string;
  takenTime?: string;
  recordedAt?: string;
  createdAt?: string;
  notes?: string;
  unit?: string;
  recordedValue?: unknown;
};

export async function djangoListAdherence(
  patientId: string,
  params?: {
    fromDate?: string;
    toDate?: string;
    type?: 'medication' | 'vital' | 'mood';
    limit?: number;
  },
): Promise<DjangoAdherenceRecord[]> {
  if (!enabled()) return [];
  try {
    const headers = await authHeaders();
    const qs = new URLSearchParams();
    if (params?.fromDate) qs.set('fromDate', params.fromDate);
    if (params?.toDate) qs.set('toDate', params.toDate);
    if (params?.type) qs.set('type', params.type);
    qs.set('limit', String(params?.limit ?? 200));
    const res = await fetch(
      `${API_BASE}/api/v1/clinical/${encodeURIComponent(patientId)}/adherence/?${qs}`,
      { headers },
    );
    if (!res.ok) return [];
    return (await djangoJson<DjangoAdherenceRecord[]>(res)) ?? [];
  } catch (error) {
    console.warn('djangoListAdherence failed:', patientId, error);
    return [];
  }
}

export type DjangoMoodEntry = {
  id: string;
  userId?: string;
  mood?: number;
  score?: number;
  note?: string;
  notes?: string;
  checkType?: string;
  recordedAt?: string;
  createdAt?: string;
};

export async function djangoListMood(
  patientId: string,
  params?: {
    fromDate?: string;
    toDate?: string;
    limit?: number;
  },
): Promise<DjangoMoodEntry[]> {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const qs = new URLSearchParams();
  if (params?.fromDate) qs.set('fromDate', params.fromDate);
  if (params?.toDate) qs.set('toDate', params.toDate);
  qs.set('limit', String(params?.limit ?? 100));
  const res = await fetch(
    `${API_BASE}/api/v1/clinical/${encodeURIComponent(patientId)}/mood/?${qs}`,
    { headers },
  );
  return djangoJson<DjangoMoodEntry[]>(res);
}

export async function djangoSaveMoodEntry(
  patientId: string,
  payload: {
    mood?: number | string;
    score?: number;
    note?: string;
    notes?: string;
    checkType?: string;
    recordedAt?: string;
    date?: string;
  },
): Promise<DjangoMoodEntry> {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/clinical/${encodeURIComponent(patientId)}/mood/`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    },
  );
  return djangoJson<DjangoMoodEntry>(res);
}

// --- Queue arrival status ---------------------------------------------------

export async function djangoUpdateArrivalStatus(
  appointmentId: string,
  arrivalStatus: string,
  checkedInBy?: string,
) {
  if (!enabled()) return { updated: false };
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/appointments/${encodeURIComponent(appointmentId)}/arrival/`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ arrivalStatus, checkedInBy }),
    },
  );
  if (!res.ok) throw new Error(`Arrival update failed: ${res.status}`);
  return djangoJson<{ updated: boolean }>(res);
}

// --- Practice daily schedule -----------------------------------------------

export async function djangoGetPracticeDailySchedule(
  practiceId: string,
  date: string,
) {
  if (!enabled()) return null;
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/schedule/${encodeURIComponent(date)}/`,
    { headers },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Schedule fetch failed: ${res.status}`);
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoSetPracticeDailySchedule(
  practiceId: string,
  date: string,
  payload: Record<string, unknown>,
) {
  if (!enabled()) return { updated: false };
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/schedule/${encodeURIComponent(date)}/`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) throw new Error(`Schedule save failed: ${res.status}`);
  return djangoJson<Record<string, unknown>>(res);
}

export async function djangoDeletePracticeDailySchedule(
  practiceId: string,
  date: string,
) {
  if (!enabled()) return { deleted: false };
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/practices/${encodeURIComponent(practiceId)}/schedule/${encodeURIComponent(date)}/`,
    { method: 'DELETE', headers },
  );
  if (!res.ok) throw new Error(`Schedule delete failed: ${res.status}`);
  return djangoJson<{ deleted: boolean }>(res);
}

export async function djangoSearchDoctors(filters: {
  medicalSpecialty?: string;
  practiceCity?: string;
  maxResults?: number;
}) {
  if (!enabled()) return [];
  const params = new URLSearchParams();
  if (filters.medicalSpecialty?.trim()) {
    params.set('specialty', filters.medicalSpecialty.trim());
  }
  if (filters.practiceCity?.trim()) {
    params.set('city', filters.practiceCity.trim());
  }
  params.set('limit', String(filters.maxResults ?? 20));
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/auth/doctors/directory/?${params}`, { headers });
  return djangoJson<Array<Record<string, unknown>>>(res);
}

export type MarketplacePartnerApplication = {
  id: string;
  partnerType: 'wellness' | 'pharmacy';
  businessName: string;
  category?: string | null;
  tagline?: string | null;
  description?: string | null;
  email: string;
  phone?: string | null;
  city?: string | null;
  province?: string | null;
  address?: string | null;
  deliveryAvailable?: boolean;
  offerings?: Array<{ name: string; description?: string; price?: string | null }>;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  createdAt?: string | null;
};

export async function djangoSubmitMarketplacePartnerApplication(
  payload: Record<string, unknown>,
) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/marketplace/partner-applications/`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return djangoJson<MarketplacePartnerApplication>(res);
}

export async function djangoGetMyMarketplacePartnerApplication() {
  if (!enabled()) return null;
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/marketplace/partner-applications/me/`, {
    headers,
  });
  return djangoJson<MarketplacePartnerApplication | null>(res);
}

export type PartnerOffering = {
  name: string;
  description?: string;
  price?: string | null;
};

export type PartnerListing = {
  applicationId: string;
  partnerType: 'wellness' | 'pharmacy';
  listingId: string;
  businessName: string;
  category?: string | null;
  tagline?: string | null;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  province?: string | null;
  address?: string | null;
  deliveryAvailable?: boolean;
  published: boolean;
  verified: boolean;
  offerings: PartnerOffering[];
  website?: string | null;
  registrationNumber?: string | null;
  operatingHours?: string | null;
  country?: string | null;
  status: string;
};

export type PartnerOrder = {
  id: string;
  pharmacyId?: string | null;
  pharmacyName?: string | null;
  pharmacyEmail?: string | null;
  status?: string | null;
  source?: string | null;
  prescriptionText?: string | null;
  lineItems?: Array<{
    name: string;
    description?: string;
    price?: string | null;
    quantity?: number;
  }>;
  notes?: string | null;
  deliveryRequested?: boolean;
  appointmentId?: string | null;
  doctorName?: string | null;
  doctorEmail?: string | null;
  patientName?: string | null;
  patientPhone?: string | null;
  patientEmail?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export async function djangoGetPartnerListing() {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/marketplace/partner/listing/me/`, { headers });
  return djangoJson<PartnerListing>(res);
}

export async function djangoUpdatePartnerListing(payload: Partial<PartnerListing>) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/api/v1/marketplace/partner/listing/me/`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return djangoJson<PartnerListing>(res);
}

export async function djangoGetPartnerOrders(status?: string) {
  if (!enabled()) return [];
  const headers = await authHeaders();
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/marketplace/partner/orders/${qs}`, { headers });
  return djangoJson<PartnerOrder[]>(res);
}

export async function djangoGetPartnerOrder(orderId: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/marketplace/partner/orders/${encodeURIComponent(orderId)}/`,
    { headers },
  );
  return djangoJson<PartnerOrder>(res);
}

export async function djangoUpdatePartnerOrderStatus(orderId: string, status: string) {
  if (!enabled()) throw new Error('Django API not configured');
  const headers = await authHeaders();
  const res = await fetch(
    `${API_BASE}/api/v1/marketplace/partner/orders/${encodeURIComponent(orderId)}/`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  );
  return djangoJson<PartnerOrder>(res);
}
