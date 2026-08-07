import {
  addDays,
  earliestBookableDate,
  formatDateOnly,
  minutesOfDay,
  parseDateOnly,
  todayInTimezone,
} from './dates';

describe('dates', () => {
  it('interpreta las fechas como medianoche UTC para no correr el dia', () => {
    const date = parseDateOnly('2026-08-08');

    expect(date.toISOString()).toBe('2026-08-08T00:00:00.000Z');
    expect(formatDateOnly(date)).toBe('2026-08-08');
  });

  it('suma dias cruzando fin de mes y de anio', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('la fecha mas temprana reservable es el dia siguiente', () => {
    const today = todayInTimezone('America/Bogota');

    expect(earliestBookableDate('America/Bogota')).toBe(addDays(today, 1));
  });

  it('usa la zona horaria de la clinica y no la del servidor', () => {
    expect(todayInTimezone('America/Bogota')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(todayInTimezone('Pacific/Kiritimati') >= todayInTimezone('Pacific/Niue')).toBe(true);
  });

  it('convierte HH:mm a minutos', () => {
    expect(minutesOfDay('00:00')).toBe(0);
    expect(minutesOfDay('09:30')).toBe(570);
    expect(minutesOfDay('23:59')).toBe(1439);
  });

  it('ordena las horas HH:mm como texto igual que cronologicamente', () => {
    const times = ['13:00', '09:00', '08:30', '23:15'];

    expect([...times].sort()).toEqual(['08:30', '09:00', '13:00', '23:15']);
  });
});
