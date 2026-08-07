export const CLINIC_TIMEZONE = "America/Bogota";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CLINIC_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today (YYYY-MM-DD) in the clinic timezone, not the device timezone. */
export function todayInBogota(): string {
  return dateFormatter.format(new Date());
}

function splitIso(isoDate: string): [number, number, number] {
  const [year = 1970, month = 1, day = 1] = isoDate.split("-").map(Number);
  return [year, month, day];
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = splitIso(isoDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Earliest bookable date: tomorrow in the clinic timezone. */
export function earliestBookableDate(): string {
  return addDaysToIsoDate(todayInBogota(), 1);
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function parts(isoDate: string) {
  const [year, month, day] = splitIso(isoDate);
  const date = new Date(Date.UTC(year, month - 1, day));
  return { year, month, day, weekday: date.getUTCDay() };
}

export function formatLongDate(isoDate: string): string {
  const { year, month, day, weekday } = parts(isoDate);
  return `${WEEKDAYS[weekday] ?? ""} ${day} de ${MONTHS[month - 1] ?? ""} de ${year}`;
}

export function formatShortDate(isoDate: string): string {
  const { month, day, weekday } = parts(isoDate);
  return `${(WEEKDAYS[weekday] ?? "").slice(0, 3)} ${day} ${(MONTHS[month - 1] ?? "").slice(0, 3)}`;
}

export function monthLabel(year: number, monthIndex: number): string {
  return `${MONTHS[monthIndex] ?? ""} ${year}`;
}

export function weekdayIndex(isoDate: string): number {
  return parts(isoDate).weekday;
}

/** Minutes since midnight for an HH:mm string. */
export function toMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
