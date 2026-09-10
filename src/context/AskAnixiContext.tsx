import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import type { AskAnixiContext } from '../services/askAnixiService';

type AskAnixiOpenOptions = {
  prompt?: string;
  context?: AskAnixiContext;
  autoSend?: boolean;
};

export type ResolvedDoctorDraft = {
  draftId: string;
  type: string;
  preview: string;
  payload: Record<string, unknown>;
  patientId?: string | null;
  appointmentId?: string | null;
};

type DraftApprovalListener = (draft: ResolvedDoctorDraft) => void;

type AskAnixiContextValue = {
  context: AskAnixiContext;
  initialPrompt: string;
  autoSend: boolean;
  openAskAnixi: (options?: AskAnixiOpenOptions) => void;
  setContext: (context: AskAnixiContext) => void;
  clearSessionPrompt: () => void;
  subscribeDraftApproved: (listener: DraftApprovalListener) => () => void;
  notifyDraftApproved: (draft: ResolvedDoctorDraft) => void;
};

const Ctx = createContext<AskAnixiContextValue | null>(null);

export function AskAnixiProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [context, setContext] = useState<AskAnixiContext>({});
  const [initialPrompt, setInitialPrompt] = useState('');
  const [autoSend, setAutoSend] = useState(false);
  const draftListenersRef = useRef(new Set<DraftApprovalListener>());

  const openAskAnixi = useCallback(
    (options?: AskAnixiOpenOptions) => {
      setContext(options?.context ?? {});
      setInitialPrompt(options?.prompt ?? '');
      setAutoSend(options?.autoSend ?? Boolean(options?.prompt));
      navigate('/ayah');
    },
    [navigate],
  );

  const setAskContext = useCallback((next: AskAnixiContext) => {
    setContext(next);
  }, []);

  const clearSessionPrompt = useCallback(() => {
    setInitialPrompt('');
    setAutoSend(false);
  }, []);

  const subscribeDraftApproved = useCallback((listener: DraftApprovalListener) => {
    draftListenersRef.current.add(listener);
    return () => {
      draftListenersRef.current.delete(listener);
    };
  }, []);

  const notifyDraftApproved = useCallback((draft: ResolvedDoctorDraft) => {
    draftListenersRef.current.forEach((listener) => listener(draft));
  }, []);

  const value = useMemo(
    () => ({
      context,
      initialPrompt,
      autoSend,
      openAskAnixi,
      setContext: setAskContext,
      clearSessionPrompt,
      subscribeDraftApproved,
      notifyDraftApproved,
    }),
    [
      context,
      initialPrompt,
      autoSend,
      openAskAnixi,
      setAskContext,
      clearSessionPrompt,
      subscribeDraftApproved,
      notifyDraftApproved,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAskAnixi() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAskAnixi must be used within AskAnixiProvider');
  return ctx;
}
