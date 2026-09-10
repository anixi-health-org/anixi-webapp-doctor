import { useEffect, useState } from 'react';
import { listenToDoctorAppointments } from '../services/appointmentService';
import type { Appointment } from '../types';

/** Visits waiting on the doctor, matches the "Pending" stat on the Appointments page. */
const awaitsDoctorAction = (appointment: Appointment): boolean =>
  appointment.status === 'pending' || appointment.status === 'rescheduled';

export const usePendingAppointmentsCount = (
  doctorId: string | undefined,
): number => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!doctorId) {
      setCount(0);
      return;
    }
    return listenToDoctorAppointments(
      doctorId,
      (appointments) => setCount(appointments.filter(awaitsDoctorAction).length),
      () => setCount(0),
    );
  }, [doctorId]);

  return count;
};
