export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `meeting_date` es una columna `date`: se maneja como medianoche UTC para evitar corrimientos. */
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Fecha de hoy en la zona horaria de la clinica, no la del servidor. */
export function todayInTimezone(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function addDays(dateOnly: string, days: number): string {
  const date = parseDateOnly(dateOnly);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateOnly(date);
}

/** Primera fecha reservable: la regla de negocio exige un dia de anticipacion. */
export function earliestBookableDate(timeZone: string): string {
  return addDays(todayInTimezone(timeZone), 1);
}

/** "2026-08-07" -> "viernes 7 de agosto de 2026", para correos y notificaciones. */
export function formatSpanishDate(dateOnly: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseDateOnly(dateOnly));
}

export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
