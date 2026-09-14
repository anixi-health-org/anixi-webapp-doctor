export const isPlaceholderPatientEmail = (email?: string): boolean =>
  Boolean(
    email &&
      (email === 'N/A' ||
        /pending\.anixi\.health$/i.test(email) ||
        email.toLowerCase().startsWith('roster+')),
  );

export const patientContactLabel = (email?: string): string => {
  if (!email) return '';
  if (isPlaceholderPatientEmail(email)) return 'Pending activation';
  return email;
};
