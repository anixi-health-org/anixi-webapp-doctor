import { Appointment } from '../types';

export const getDailyAppointmentStats = (appointments: Appointment[]) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayEnd = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const weekEnd = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  return {
    todayCount: appointments.filter((a) => {
      const appointmentDate = new Date(a.startTime);
      return appointmentDate >= startOfToday && appointmentDate < todayEnd;
    }).length,

    weekCount: appointments.filter((a) => {
      const appointmentDate = new Date(a.startTime);
      return appointmentDate >= startOfWeek && appointmentDate < weekEnd;
    }).length,

    monthCount: appointments.filter((a) => {
      const appointmentDate = new Date(a.startTime);
      return appointmentDate >= startOfMonth && appointmentDate <= monthEnd;
    }).length,
  };
};

export const groupAppointmentsByDate = (appointments: Appointment[]) => {
  const grouped: { [date: string]: Appointment[] } = {};

  appointments.forEach((appointment) => {
    const dateKey = new Date(appointment.startTime).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(appointment);
  });

  return grouped;
};

export const groupAppointmentsByStatus = (appointments: Appointment[]) => {
  return {
    scheduled: appointments.filter((a) => a.status === 'scheduled'),
    confirmed: appointments.filter((a) => a.status === 'confirmed'),
    completed: appointments.filter((a) => a.status === 'completed'),
    cancelled: appointments.filter((a) => a.status === 'cancelled'),
  };
};


export const getNextUpcomingAppointment = (appointments: Appointment[]): Appointment | null => {
  const now = new Date();
  const upcoming = appointments
    .filter((a) => new Date(a.startTime) > now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return upcoming.length > 0 ? upcoming[0] : null;
};


export const getAppointmentsByPatient = (appointments: Appointment[], patientId: string) => {
  return appointments.filter((a) => a.patientId === patientId);
};


export const getOverdueAppointments = (appointments: Appointment[]) => {
  const now = new Date();
  return appointments
    .filter((a) => new Date(a.endTime) < now && a.status === 'scheduled')
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
};


export const getAppointmentDuration = (appointment: Appointment): number => {
  return Math.round(
    (new Date(appointment.endTime).getTime() - new Date(appointment.startTime).getTime()) / 60000
  );
};


export const isAppointmentDueSoon = (appointment: Appointment, minutes: number = 60): boolean => {
  const now = new Date();
  const appointmentStart = new Date(appointment.startTime);
  const timeDifference = appointmentStart.getTime() - now.getTime();
  const minutesDifference = timeDifference / (1000 * 60);

  return minutesDifference > 0 && minutesDifference <= minutes;
};


export const formatAppointmentTimeRange = (
  startTime: Date | string,
  endTime: Date | string
): string => {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;

  const startStr = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const endStr = end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return `${startStr} - ${endStr}`;
};


export const canCancelAppointment = (appointment: Appointment): boolean => {
  return appointment.status !== 'completed' && appointment.status !== 'cancelled';
};


export const canCompleteAppointment = (appointment: Appointment): boolean => {
  return appointment.status !== 'completed' && appointment.status !== 'cancelled';
};
