import { renderHook } from '@testing-library/react';
import { usePermissions } from './usePermissions';
import { useAuth } from './AuthContext';

jest.mock('./AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockedUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('usePermissions', () => {
  it('returns denied permissions when there is no practice session', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      practiceSession: null,
      isLoading: false,
      isAuthenticated: false,
      login: jest.fn(),
      logout: jest.fn(),
      refreshPracticeSession: jest.fn(),
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.isOwner).toBe(false);
    expect(result.current.isDelegate).toBe(false);
    expect(result.current.can('manageAppointments')).toBe(false);
    expect(result.current.can('overrideConflicts')).toBe(false);
  });

  it('enforces member-level permission flags', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      practiceSession: {
        practice: {
          id: 'practice-1',
          name: 'Demo Practice',
          timezone: 'Africa/Johannesburg',
          ownerId: 'owner-1',
          locations: [],
          consultTypes: ['initial'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        member: {
          uid: 'delegate-1',
          practiceId: 'practice-1',
          role: 'delegate',
          permissions: {
            manageAppointments: true,
            manageSoftBlocks: false,
            overrideConflicts: false,
            editBookingPolicies: true,
          },
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        bookingPolicy: {
          practiceId: 'practice-1',
          patientCancellationWindowHours: 24,
          doctorCancellationWindowHours: 1,
          noShowPolicyText: '',
          confirmationMode: 'doctor_confirms',
          updatedAt: new Date(),
        },
      },
      isLoading: false,
      isAuthenticated: true,
      login: jest.fn(),
      logout: jest.fn(),
      refreshPracticeSession: jest.fn(),
    });

    const { result } = renderHook(() => usePermissions());

    expect(result.current.isOwner).toBe(false);
    expect(result.current.isDelegate).toBe(true);
    expect(result.current.can('manageAppointments')).toBe(true);
    expect(result.current.can('manageSoftBlocks')).toBe(false);
    expect(result.current.can('overrideConflicts')).toBe(false);
    expect(result.current.can('editBookingPolicies')).toBe(true);
  });
});
