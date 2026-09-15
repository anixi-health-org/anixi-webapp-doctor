import {
  clearDjangoTokens,
  djangoGetMe,
  djangoLogin,
  djangoRegister,
  enrichDoctorMediaUrls,
} from './djangoApiService';
import { mapDjangoMeToProfessionalUser } from './djangoUserMapper';
import { Doctor, ProfessionalUser } from '../types';
import { AuthRole, JoinPath } from '../types/auth';

export const registerProfessional = async (
  email: string,
  password: string,
  displayName: string,
  role: AuthRole,
  _countryCode?: string,
  _joinPath?: JoinPath,
): Promise<void> => {
  const djangoRole =
    role === 'staff' ? 'staff' : role === 'caregiver' ? 'caregiver' : 'doctor';
  await djangoRegister({
    email: email.trim(),
    password,
    displayName,
    role: djangoRole,
  });
};

export const loginProfessional = async (
  email: string,
  password: string,
  expectedRole?: AuthRole,
): Promise<ProfessionalUser> => {
  const trimmedEmail = email.trim();
  try {
    const result = await djangoLogin(trimmedEmail, password);
    const role = String(result.user?.role ?? '');
    if (role !== 'doctor' && role !== 'staff' && role !== 'caregiver') {
      clearDjangoTokens();
      throw new Error(
        'This account cannot sign in to the doctor portal. Use the Anixi Health admin portal.',
      );
    }
    const professional = await enrichDoctorMediaUrls(
      mapDjangoMeToProfessionalUser(result.user),
    );
    if (expectedRole && professional.role !== expectedRole) {
      clearDjangoTokens();
      throw new Error(
        `This account is registered as a ${professional.role}. Please sign in with that account type.`,
      );
    }
    return professional;
  } catch (error: unknown) {
    throw new Error(loginErrorMessage(error));
  }
};

function loginErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  const haystack = message.toLowerCase();

  if (
    haystack.includes('invalid') ||
    haystack.includes('credentials') ||
    haystack.includes('password')
  ) {
    return 'Invalid email or password.';
  }
  if (haystack.includes('network')) {
    return 'Network error. Check your connection and try again.';
  }
  if (message) return message;
  return 'Could not sign in. Please try again.';
}

export const loginDoctor = async (email: string, password: string): Promise<Doctor> => {
  const user = await loginProfessional(email, password, 'doctor');
  return user as Doctor;
};

export const logoutDoctor = async (): Promise<void> => {
  clearDjangoTokens();
};

export const getCurrentProfessionalFromSession = async (): Promise<ProfessionalUser | null> => {
  const me = await djangoGetMe();
  if (!me) return null;
  const role = String(me.role ?? '');
  if (role !== 'doctor' && role !== 'staff' && role !== 'caregiver') {
    clearDjangoTokens();
    return null;
  }
  return enrichDoctorMediaUrls(mapDjangoMeToProfessionalUser(me));
};

export const getCurrentDoctor = async (): Promise<Doctor | null> => {
  const user = await getCurrentProfessionalFromSession();
  return user?.role === 'doctor' ? (user as Doctor) : null;
};
