export const calculateAge = (dateOfBirth?: Date): number | null => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const dob = new Date(dateOfBirth);
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : null;
};
export const formatDate = (date?: Date, format: 'short' | 'long' = 'short'): string | null => {
  if (!date) return null;
  const d = new Date(date);
  if (format === 'short') {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
export const formatName = (name?: string): string | null => {
  if (!name) return null;
  return name.trim().length > 0 ? name.trim() : null;
};
export const formatGender = (gender?: string): string | null => {
  if (!gender) return null;
  const g = gender.toLowerCase().trim();
  if (g === 'male' || g === 'm') return 'Male';
  if (g === 'female' || g === 'f') return 'Female';
  if (g === 'other' || g === 'o') return 'Other';
  return g.charAt(0).toUpperCase() + g.slice(1);
};
export const formatPhone = (phone?: string): string | null => {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length < 10) return null;
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone.trim();
};
export const formatAddress = (address?: string): string | null => {
  if (!address) return null;
  return address.trim().length > 0 ? address.trim() : null;
};
export const formatEmail = (email?: string): string | null => {
  if (!email) return null;
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
};
export const isEmpty = (value: any): boolean => {
  return value === null || value === undefined || value === '' || value === 'N/A' || value === 'undefined';
};
export const calculateAdherence = (adherenceLogs?: any[]): number => {
  if (!adherenceLogs || adherenceLogs.length === 0) return 0;
  const taken = adherenceLogs.filter((log) => log.taken === true).length;
  return Math.round((taken / adherenceLogs.length) * 100);
};
export const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  if (value?.seconds && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  return null;
};
export const formatTimestamp = (
  value: any,
  format: 'short' | 'long' | 'time' = 'short'
): string => {
  const date = toDate(value);
  if (!date) return 'N/A';
  try {
    switch (format) {
      case 'short':
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      case 'long':
        return date.toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      case 'time':
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
      default:
        return date.toLocaleDateString();
    }
  } catch (error) {
    ;
    return 'Invalid date';
  }
};
