export const sharingQueryKeys = {
  patientRequests: (patientUid: string) => ['sharing-requests', patientUid] as const,
  incomingRequests: (doctorUid: string) => ['incoming-sharing-requests', doctorUid] as const,
};

export const permissionsQueryKeys = {
  practicePermissions: (doctorUid: string) => ['practice-permissions', doctorUid] as const,
};
