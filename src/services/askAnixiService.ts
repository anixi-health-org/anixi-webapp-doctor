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
  clinicDate?: string;
  clinicTimezone?: string;
  onboardingFlow?: string;
  onboardingStep?: string | number;
  onboardingStepLabel?: string;
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
    return (await djangoListDoctorDrafts()) as DoctorAgentDraft[];
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
    return { draftId, status: result?.status, type: undefined };
  }
  // Firebase Functions path removed.
  return { draftId, status: decision === 'approved' ? 'approved' : 'rejected' };
}
