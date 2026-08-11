import { CalendarClock, MapPin, User } from "lucide-react";

import type { Reservation, Room } from "@/lib/api/types";
import {
  DAY_END_MIN,
  DAY_START_MIN,
  blockGeometry,
  roomColorVar,
  withColumns,
} from "./calendar-utils";
import { cn } from "@/lib/utils";

const HOURS = Array.from(
  { length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 },
  (_, index) => DAY_START_MIN / 60 + index,
);

export function DayGrid({
  reservations,
  rooms,
  onSelect,
  onEmptySlot,
}: {
  reservations: Reservation[];
  rooms: Room[];
  onSelect: (reservation: Reservation) => void;
  onEmptySlot?: (startTime: string) => void;
}) {
  const laidOut = withColumns(reservations);
  const columns = Math.max(1, ...laidOut.map((item) => item.column + 1));

  return (
    <div className="cal-panel rounded-2xl border border-border bg-card/95 p-3 shadow-soft backdrop-blur-sm">
      <div className="relative flex">
        <div className="w-12 shrink-0">
          {HOURS.slice(0, -1).map((hour) => (
            <div key={hour} className="h-16 pr-2 text-right text-[11px] text-muted-foreground">
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        <div className="relative flex-1">
          {HOURS.slice(0, -1).map((hour) => (
            <button
              key={hour}
              type="button"
              disabled={!onEmptySlot}
              onClick={() => onEmptySlot?.(`${String(hour).padStart(2, "0")}:00`)}
              className={cn(
                "block h-16 w-full border-t border-dashed border-border/70 text-left transition-colors duration-150",
                "hover:bg-gradient-to-r hover:from-accent/8 hover:to-transparent",
                "disabled:cursor-default disabled:hover:bg-transparent",
              )}
              aria-label={`Reservar a las ${String(hour).padStart(2, "0")}:00`}
            />
          ))}
          <div className="pointer-events-none absolute inset-0">
            {laidOut.map(({ reservation, column }, index) => {
              const { topPct, heightPct } = blockGeometry(reservation);
              const color = roomColorVar(rooms, reservation.roomId);
              return (
                <button
                  key={reservation.id}
                  type="button"
                  onClick={() => onSelect(reservation)}
                  style={{
                    top: `${topPct}%`,
                    height: `${heightPct}%`,
                    left: `${(column / columns) * 100}%`,
                    width: `${(1 / columns) * 100}%`,
                    borderLeftColor: color,
                    backgroundColor: `color-mix(in oklab, ${color} 16%, var(--card))`,
                    boxShadow: `0 8px 22px -16px color-mix(in oklab, ${color} 55%, transparent)`,
                    animationDelay: `${index * 55}ms`,
                  }}
                  className="pointer-events-auto absolute overflow-hidden rounded-lg border border-border border-l-4 p-2 pr-2.5 text-left transition-colors duration-150 hover:z-10 hover:brightness-[1.03] active:scale-[0.99]"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 w-1 opacity-80"
                    style={{
                      background: `linear-gradient(180deg, ${color}, transparent)`,
                    }}
                  />
                  <p className="truncate text-xs font-semibold text-foreground">
                    {reservation.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <MapPin className="size-3 shrink-0" style={{ color }} />
                    {reservation.roomName}
                  </p>
                  <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <CalendarClock className="size-3 shrink-0" />
                    {reservation.startTime}–{reservation.endTime}
                  </p>
                  <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                    <User className="size-3 shrink-0" />
                    {reservation.organizerName}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
