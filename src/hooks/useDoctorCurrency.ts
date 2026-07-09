import { useMemo } from 'react';
import { formatCurrency, resolveDoctorCurrency } from '../lib/currency';
import { useAuth } from './AuthContext';

export function useDoctorCurrency() {
  const { user, practiceSession } = useAuth();
  const doctor = user?.role === 'doctor' ? user : null;

  return useMemo(() => {
    const currency = resolveDoctorCurrency({
      currency: doctor?.currency,
      country: doctor?.country,
      timezone: practiceSession?.practice?.timezone,
      nationality: doctor?.nationality,
    });

    const country = doctor?.country;

    const formatAmount = (amount: number, overrideCurrency?: string) =>
      formatCurrency(amount, overrideCurrency ?? currency, country);

    return { currency, country, formatAmount };
  }, [doctor, practiceSession?.practice?.timezone]);
}
