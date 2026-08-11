import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DayGrid } from "@/components/nexus/DayGrid";
import { MonthGrid } from "@/components/nexus/MonthGrid";
import { roomColorVar } from "@/components/nexus/calendar-utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reservationsApi, roomsApi } from "@/lib/api/endpoints";
import type { Reservation } from "@/lib/api/types";
import { toastApiError } from "@/lib/api-errors";
import { canCancel, canCreateReservations, useAuth } from "@/lib/auth";
import {
  addDaysToIsoDate,
  formatLongDate,
  formatShortDate,
  todayInBogota,
} from "@/lib/bogota";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendario de salas — Nexus Calendar" },
      {
        name: "description",
        content:
          "Ocupación de las salas de reuniones de la Clínica Regional del San Jorge por día y sala.",
      },
      { property: "og:title", content: "Calendario de salas — Nexus Calendar" },
      { property: "og:description", content: "Consulta la ocupación por día y sala." },
      { property: "og:url", content: "/calendario" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/calendario" }],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(() => todayInBogota());
  const [roomFilter, setRoomFilter] = useState<string>("all");
  const [detail, setDetail] = useState<Reservation | null>(null);

  const canCreate = canCreateReservations(user);

  const monthStart = `${selectedDate.slice(0, 7)}-01`;
  const monthEnd = addDaysToIsoDate(monthStart, 41);

  const roomsQuery = useQuery({ queryKey: ["rooms"], queryFn: () => roomsApi.list() });
  const rooms = useMemo(() => roomsQuery.data?.items ?? [], [roomsQuery.data]);

  const reservationsQuery = useQuery({
    queryKey: ["reservations", monthStart, monthEnd],
    // Sin `status`: el API devuelve solo las confirmadas.
    queryFn: () => reservationsApi.list({ from: monthStart, to: monthEnd }),
  });

  const allReservations = reservationsQuery.data?.items ?? [];
  const visible = allReservations.filter(
    (reservation) => roomFilter === "all" || reservation.roomId === roomFilter,
  );
  const dayReservations = visible.filter(
    (reservation) => reservation.meetingDate === selectedDate,
  );

  const cancelMutation = useMutation({
    mutationFn: (id: string) => reservationsApi.cancel(id),
    onSuccess: () => {
      toast.success("Reserva cancelada");
      setDetail(null);
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: (error) => toastApiError(error, "No fue posible cancelar la reserva."),
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 animate-rise">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Ocupación de salas
          </p>
          <h1 className="font-display text-2xl font-semibold capitalize text-foreground">
            {formatLongDate(selectedDate)}
          </h1>
        </div>
        {canCreate && (
          <Button
            className="hover-lift"
            onClick={() =>
              navigate({ to: "/reservas/nueva", search: { date: selectedDate } as never })
            }
          >
            <Plus className="size-4" />
            Nueva reserva
          </Button>
        )}
      </header>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Día anterior"
          onClick={() => setSelectedDate((date) => addDaysToIsoDate(date, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setSelectedDate(todayInBogota())}
        >
          <CalendarDays className="size-4" />
          Hoy
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Día siguiente"
          onClick={() => setSelectedDate((date) => addDaysToIsoDate(date, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <FilterChip active={roomFilter === "all"} onClick={() => setRoomFilter("all")}>
          Todas las salas
        </FilterChip>
        {rooms.map((room) => (
          <FilterChip
            key={room.id}
            active={roomFilter === room.id}
            onClick={() => setRoomFilter(room.id)}
            color={roomColorVar(rooms, room.id)}
          >
            {room.name}
          </FilterChip>
        ))}
      </div>

      <MonthGrid
        anchorDate={selectedDate}
        selectedDate={selectedDate}
        reservations={visible}
        rooms={rooms}
        onSelectDate={setSelectedDate}
      />

      {reservationsQuery.isLoading ? (
        <div className="grid h-40 place-items-center rounded-2xl border border-border bg-card">
          <Loader2 className="size-5 animate-spin text-accent" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-foreground">
              {formatShortDate(selectedDate)} · {dayReservations.length}{" "}
              {dayReservations.length === 1 ? "reunión" : "reuniones"}
            </h2>
            {dayReservations.length === 0 && (
              <span className="text-xs text-muted-foreground">Sala libre todo el día</span>
            )}
          </div>
          <DayGrid
            reservations={dayReservations}
            rooms={rooms}
            onSelect={setDetail}
            {...(canCreate
              ? {
                  onEmptySlot: (startTime: string) =>
                    navigate({
                      to: "/reservas/nueva",
                      search: {
                        date: selectedDate,
                        start: startTime,
                        roomId: roomFilter === "all" ? undefined : roomFilter,
                      } as never,
                    }),
                }
              : {})}
          />
        </>
      )}

      {reservationsQuery.isError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          No fue posible cargar las reservas. Verifica la conexión con el API.
        </p>
      )}

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">{detail.title}</DialogTitle>
                <DialogDescription>
                  {detail.roomName} · {detail.startTime}–{detail.endTime}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                <p className="capitalize text-muted-foreground">
                  {formatLongDate(detail.meetingDate)}
                </p>
                <p>
                  <span className="text-muted-foreground">Organiza: </span>
                  {detail.organizerName}
                </p>
                {detail.description && (
                  <p className="text-muted-foreground">{detail.description}</p>
                )}
                {detail.invitees.length > 0 && (
                  <div>
                    <p className="text-muted-foreground">Invitados</p>
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {detail.invitees.map((invitee) => (
                        <li
                          key={invitee.email}
                          className="rounded-full bg-secondary px-2 py-0.5 text-xs"
                        >
                          {invitee.email}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {canCancel(user, detail.organizerId) && (
                <DialogFooter>
                  <Button
                    variant="destructive"
                    onClick={() => cancelMutation.mutate(detail.id)}
                    disabled={cancelMutation.isPending}
                  >
                    {cancelMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Cancelar reserva
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-95",
        active
          ? "border-accent bg-accent/12 text-foreground shadow-[0_0_0_3px_oklch(0.68_0.176_48_/_0.12)]"
          : "border-border bg-card/90 text-muted-foreground hover:border-accent/40 hover:bg-accent/5 hover:text-foreground",
      )}
    >
      {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} />}
      {children}
    </button>
  );
}
