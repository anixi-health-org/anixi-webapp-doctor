import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptDelegateInvitation,
  deactivateDelegate,
  ensurePracticePermissions,
  getPracticePermissions,
  inviteDelegate,
  InviteDelegateInput,
} from '../services/permissions/practicePermissionsService';
import { queueDelegateInvitationEmail } from '../services/permissions/delegateInviteEmail';
import { permissionsQueryKeys } from './queries/queryKeys';

export const usePracticePermissions = (doctorUid: string | undefined) =>
  useQuery({
    queryKey: permissionsQueryKeys.practicePermissions(doctorUid ?? ''),
    queryFn: async () => {
      const existing = await getPracticePermissions(doctorUid!);
      if (existing) return existing;
      return ensurePracticePermissions(doctorUid!);
    },
    enabled: Boolean(doctorUid),
  });

export const useInviteDelegate = (doctorUid: string | undefined, doctorName: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InviteDelegateInput) => {
      const { delegateId, delegate } = await inviteDelegate(doctorUid!, input);
      try {
        await queueDelegateInvitationEmail({
          to: delegate.email,
          doctorName,
          doctorId: doctorUid!,
          delegateId,
        });
      } catch {
        // Invitation saved; email queue is best-effort (SMTP may be misconfigured)
      }
      return { delegateId, delegate };
    },
    onSuccess: () => {
      if (doctorUid) {
        void queryClient.invalidateQueries({
          queryKey: permissionsQueryKeys.practicePermissions(doctorUid),
        });
      }
    },
  });
};

export const useDeactivateDelegate = (doctorUid: string | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (delegateId: string) => deactivateDelegate(doctorUid!, delegateId),
    onSuccess: () => {
      if (doctorUid) {
        void queryClient.invalidateQueries({
          queryKey: permissionsQueryKeys.practicePermissions(doctorUid),
        });
      }
    },
  });
};

export const useAcceptDelegateInvitation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      doctorId,
      delegateId,
      user,
    }: {
      doctorId: string;
      delegateId: string;
      user: { uid: string; email?: string | null; displayName?: string | null };
    }) => acceptDelegateInvitation(doctorId, delegateId, user),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: permissionsQueryKeys.practicePermissions(variables.doctorId),
      });
    },
  });
};
