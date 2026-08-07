import type { Reservation, Room } from "@/lib/api/types";
import { toMinutes } from "@/lib/bogota";

export const ROOM_TOKENS = ["room-1", "room-2", "room-3", "chart-4", "chart-5"] as const;

export function roomColorVar(rooms: Room[], roomId: string): string {
  const index = Math.max(
    0,
    rooms.findIndex((room) => room.id === roomId),
  );
  const token = ROOM_TOKENS[index % ROOM_TOKENS.length] ?? "room-1";
  return `var(--${token})`;
}

export const DAY_START_MIN = 6 * 60;
export const DAY_END_MIN = 21 * 60;

export function blockGeometry(reservation: Reservation) {
  const start = Math.max(toMinutes(reservation.startTime), DAY_START_MIN);
  const end = Math.min(toMinutes(reservation.endTime), DAY_END_MIN);
  const total = DAY_END_MIN - DAY_START_MIN;
  return {
    topPct: ((start - DAY_START_MIN) / total) * 100,
    heightPct: (Math.max(end - start, 20) / total) * 100,
  };
}

/** Lays out overlapping reservations side by side inside the same day column. */
export function withColumns(reservations: Reservation[]) {
  const sorted = [...reservations].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime),
  );
  const columnEnds: number[] = [];
  return sorted.map((reservation) => {
    const start = toMinutes(reservation.startTime);
    const end = toMinutes(reservation.endTime);
    let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
    if (column === -1) {
      column = columnEnds.length;
    }
    columnEnds[column] = end;
    return { reservation, column };
  });
}
