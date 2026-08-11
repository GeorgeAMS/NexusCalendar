import { useRef } from "react";

import type { Reservation, Room } from "@/lib/api/types";
import { addDaysToIsoDate, monthLabel, todayInBogota, weekdayIndex } from "@/lib/bogota";
import { roomColorVar } from "./calendar-utils";
import { cn } from "@/lib/utils";

const WEEK_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function monthDays(year: number, monthIndex: number): string[] {
  const days: string[] = [];
  const first = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  let cursor = first;
  while (Number(cursor.slice(5, 7)) === monthIndex + 1) {
    days.push(cursor);
    cursor = addDaysToIsoDate(cursor, 1);
  }
  return days;
}

export function MonthGrid({
  anchorDate,
  selectedDate,
  reservations,
  rooms,
  onSelectDate,
}: {
  anchorDate: string;
  selectedDate: string;
  reservations: Reservation[];
  rooms: Room[];
  onSelectDate: (date: string) => void;
}) {
  const year = Number(anchorDate.slice(0, 4));
  const monthIndex = Number(anchorDate.slice(5, 7)) - 1;
  const days = monthDays(year, monthIndex);
  const firstDay = days[0] ?? anchorDate;
  const leadingBlanks = (weekdayIndex(firstDay) + 6) % 7;
  const today = todayInBogota();
  const pointerStart = useRef<{ x: number; y: number } | null>(null);

  const byDate = new Map<string, Reservation[]>();
  for (const reservation of reservations) {
    const list = byDate.get(reservation.meetingDate) ?? [];
    list.push(reservation);
    byDate.set(reservation.meetingDate, list);
  }

  function handleDayPointerDown(event: React.PointerEvent) {
    pointerStart.current = { x: event.clientX, y: event.clientY };
  }

  function handleDayClick(event: React.MouseEvent, date: string) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (start) {
      const dx = Math.abs(event.clientX - start.x);
      const dy = Math.abs(event.clientY - start.y);
      // Ignore click synthesized after a vertical scroll/swipe.
      if (dx > 10 || dy > 10) {
        return;
      }
    }
    onSelectDate(date);
  }

  return (
    <div className="cal-panel rounded-2xl border border-border bg-card/95 p-3 shadow-soft backdrop-blur-sm">
      <p className="relative mb-2 text-center font-display text-sm font-semibold capitalize text-foreground">
        {monthLabel(year, monthIndex)}
      </p>
      <div className="relative grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
        {WEEK_LABELS.map((label, index) => (
          <span key={`${label}-${index}`}>{label}</span>
        ))}
      </div>
      <div className="relative mt-1 grid grid-cols-7 gap-1 touch-pan-y">
        {Array.from({ length: leadingBlanks }).map((_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {days.map((date) => {
          const dayReservations = byDate.get(date) ?? [];
          const isSelected = date === selectedDate;
          const isToday = date === today;
          return (
            <button
              key={date}
              type="button"
              onPointerDown={handleDayPointerDown}
              onClick={(event) => handleDayClick(event, date)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border text-sm transition-colors duration-150 active:scale-95",
                isSelected
                  ? "border-accent bg-accent text-accent-foreground shadow-soft"
                  : "border-transparent hover:border-accent/30 hover:bg-accent/8",
                isToday && !isSelected && "border-accent/50 bg-accent/5",
              )}
            >
              <span className={cn("font-medium", isSelected && "font-semibold")}>
                {Number(date.slice(8, 10))}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {dayReservations.slice(0, 3).map((reservation) => (
                  <span
                    key={reservation.id}
                    className="size-1.5 rounded-full"
                    style={{
                      backgroundColor: isSelected
                        ? "var(--accent-foreground)"
                        : roomColorVar(rooms, reservation.roomId),
                    }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
