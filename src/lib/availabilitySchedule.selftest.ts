import {
  periodsOverlap,
  validateAvailabilityPeriods,
  toMinutes,
} from './availabilitySchedule';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(toMinutes('08:00') === 480, '08:00 minutes');
assert(toMinutes('14:30') === 870, '14:30 minutes');

assert(
  validateAvailabilityPeriods([
    { startTime: '08:00', endTime: '12:00' },
    { startTime: '14:00', endTime: '17:00' },
  ]).ok === true,
  'split shift valid',
);

assert(
  validateAvailabilityPeriods([{ startTime: '12:00', endTime: '08:00' }]).ok ===
    false,
  'end before start invalid',
);

assert(
  periodsOverlap(
    { startTime: '08:00', endTime: '12:00' },
    { startTime: '11:00', endTime: '13:00' },
  ) === true,
  'overlap detected',
);

assert(
  validateAvailabilityPeriods([
    { startTime: '08:00', endTime: '12:00' },
    { startTime: '11:30', endTime: '15:00' },
  ]).ok === false,
  'overlapping periods rejected',
);

assert(
  validateAvailabilityPeriods([
    { startTime: '08:00', endTime: '12:00' },
    { startTime: '08:00', endTime: '12:00' },
  ]).ok === false,
  'duplicates rejected',
);

assert(validateAvailabilityPeriods([]).ok === true, 'empty day allowed');

console.log('PASS availabilitySchedule tests');
