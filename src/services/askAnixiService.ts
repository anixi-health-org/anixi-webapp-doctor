import {
  djangoCompanionStream,
  djangoListDoctorDrafts,
  djangoResolveDoctorDraft,
  isDjangoApiEnabled,
} from './djangoApiService';

export type AskAnixiContext = {
  patientId?: string;
  appointmentId?: string;
  patientName?: string;
  practiceId?: string;
  practiceSnapshot?: Record<string, unknown>;
  patientSnapshot?: Record<string, unknown>;
  dashboardIntent?: string;
  clinicDate?: string;
  clinicTimezone?: string;
  onboardingFlow?: string;
  onboardingStep?: string | number;
  onboardingStepLabel?: string;
  /** When set, Ayah returns here after the doctor approves a clinical_report draft. */
  returnPath?: string;
  /** Signals Ayah to run the H&P report drafting workflow. */
  draftIntent?: 'clinical_report' | 'clinical_note' | 'message_reply';
  visitNote?: string;
  scribeSummary?: string;
};

export type DoctorAgentDraft = {
  id: string;
  type: string;
  status: string;
  preview?: string;
  payload?: Record<string, unknown>;
  patientId?: string;
  appointmentId?: string;
};

export type ResolvedDoctorDraftResult = {
  draftId: string;
  preview?: string;
  payload?: Record<string, unknown>;
  type?: string;
  patientId?: string | null;
  appointmentId?: string | null;
  status?: string;
  sent?: boolean;
};

function normalizeDoctorDraft(row: Record<string, unknown>): DoctorAgentDraft {
  const preview =
    (typeof row.preview === 'string' && row.preview) ||
    (typeof row.content === 'string' && row.content) ||
    '';
  return {
    id: String(row.id),
    type: String(row.type ?? ''),
    status: String(row.status ?? ''),
    preview,
    payload: (row.payload as Record<string, unknown> | undefined) ?? {},
    patientId: row.patientId != null ? String(row.patientId) : undefined,
    appointmentId: row.appointmentId != null ? String(row.appointmentId) : undefined,
  };
}

export function formatAskAnixiError(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'Request cancelled';
    if (/Start Mastra locally|Ayah cloud proxy is not configured/.test(err.message)) {
      if (process.env.NODE_ENV === 'production' || process.env.REACT_APP_AYAH_USE_CLOUD_ONLY === 'true') {
        return 'Ayah is temporarily unavailable. Please try again in a moment.';
      }
      return err.message;
    }
    if (err.message === 'Failed to fetch') {
      if (process.env.NODE_ENV === 'production' || process.env.REACT_APP_AYAH_USE_CLOUD_ONLY === 'true') {
        return 'Cannot reach Ayah right now. Check your connection and try again.';
      }
      return 'Cannot reach Ayah. Start Mastra locally: cd anixi-agents && npm run dev';
    }
    return err.message;
  }
  return 'Ayah is unavailable right now. Please try again.';
}

export async function streamAskAnixi(params: {
  message: string;
  context?: AskAnixiContext;
  threadId?: string;
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  // Django path owns the companion stream once REACT_APP_ANIXI_API_URL is set.
  if (isDjangoApiEnabled()) {
    await djangoCompanionStream({
      message: params.message,
      context: params.context,
      threadId: params.threadId,
      onChunk: params.onChunk,
      signal: params.signal,
    });
    return;
  }

  // Firebase Auth is gone. There is no currentFirebaseUser to mint an ID token, and
  // the old Mastra cloud/local paths relied on Firebase Functions + an ID token.
  // Without a Django backend configured the stream is unavailable.
  throw new Error(
    'Ayah is not available. Set REACT_APP_ANIXI_API_URL to enable the Django companion stream, or start Mastra locally.',
  );
}

export async function listDoctorPendingDrafts(): Promise<DoctorAgentDraft[]> {
  if (isDjangoApiEnabled()) {
    const rows = (await djangoListDoctorDrafts()) as Record<string, unknown>[];
    return rows.map(normalizeDoctorDraft);
  }
  // Firebase Functions path removed.
  return [];
}

export async function resolveDoctorDraft(
  draftId: string,
  decision: 'approved' | 'rejected',
): Promise<ResolvedDoctorDraftResult> {
  if (isDjangoApiEnabled()) {
    const result = await djangoResolveDoctorDraft(draftId, decision);
    return {
      draftId,
      status: result?.status,
      type: result?.type,
      preview: result?.preview,
      payload: result?.payload,
      patientId: result?.patientId ?? null,
      appointmentId: result?.appointmentId ?? null,
      sent: result?.sent,
    };
  }
  // Firebase Functions path removed.
  return { draftId, status: decision === 'approved' ? 'approved' : 'rejected' };
}
