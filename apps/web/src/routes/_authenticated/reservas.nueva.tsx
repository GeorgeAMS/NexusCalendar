import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, CalendarPlus, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InviteesField,
  inviteEmailsFromDrafts,
  type InviteDraft,
} from "@/components/nexus/invitees-field";
import { reservationsApi, roomsApi } from "@/lib/api/endpoints";
import type { CreateReservationBody, RoomConflictDetails } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import { errorMessage, toastApiError } from "@/lib/api-errors";
import { canCreateReservations, useAuth } from "@/lib/auth";
import { earliestBookableDate, formatLongDate, isValidTime, toMinutes } from "@/lib/bogota";
import { roomColorVar } from "@/components/nexus/calendar-utils";
import { cn } from "@/lib/utils";

type Search = { date?: string | undefined; start?: string | undefined; roomId?: string | undefined };

export const Route = createFileRoute("/_authenticated/reservas/nueva")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    date: typeof search["date"] === "string" ? search["date"] : undefined,
    start: typeof search["start"] === "string" ? search["start"] : undefined,
    roomId: typeof search["roomId"] === "string" ? search["roomId"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Nueva reserva — Nexus Calendar" },
      {
        name: "description",
        content: "Reserva una sala de reuniones de la Clínica Regional del San Jorge.",
      },
      { property: "og:title", content: "Nueva reserva — Nexus Calendar" },
      {
        property: "og:description",
        content: "Agenda una sala e invita por perfil o correo.",
      },
      { property: "og:url", content: "/reservas/nueva" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/reservas/nueva" }],
  }),
  component: NewReservationPage,
});

function NewReservationPage() {
  const { user } = useAuth();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const minDate = earliestBookableDate();
  const [meetingDate, setMeetingDate] = useState(
    search.date && search.date >= minDate ? search.date : minDate,
  );
  const [startTime, setStartTime] = useState(search.start ?? "08:00");
  const [endTime, setEndTime] = useState(() => {
    const base = search.start ?? "08:00";
    const [h = 8] = base.split(":").map(Number);
    return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:00`;
  });
  const [roomId, setRoomId] = useState(search.roomId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [invitees, setInvitees] = useState<InviteDraft[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<RoomConflictDetails | null>(null);
  const [conflictMessage, setConflictMessage] = useState("");

  const roomsQuery = useQuery({ queryKey: ["rooms"], queryFn: () => roomsApi.list() });
  const rooms = useMemo(() => roomsQuery.data?.items ?? [], [roomsQuery.data]);
  const inviteeEmails = inviteEmailsFromDrafts(invitees);

  const createMutation = useMutation({
    mutationFn: (body: CreateReservationBody) => reservationsApi.create(body),
    onSuccess: async (reservation) => {
      toast.success("Reserva confirmada", {
        description: `${reservation.roomName} · ${reservation.startTime}–${reservation.endTime}`,
      });
      setConflict(null);
      await queryClient.invalidateQueries({ queryKey: ["reservations"] });
      await navigate({ to: "/calendario" });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "ROOM_CONFLICT") {
        const details = error.details as unknown as RoomConflictDetails;
        setConflictMessage(error.message);
        setConflict({
          conflicts: details?.conflicts ?? [],
          canOverride: details?.canOverride === true,
        });
        return;
      }
      if (error instanceof ApiError && error.code === "ADVANCE_NOTICE") {
        const earliest =
          typeof error.details["earliestDate"] === "string"
            ? (error.details["earliestDate"] as string)
            : minDate;
        setFieldErrors({ meetingDate: `${error.message} Fecha mínima: ${formatLongDate(earliest)}.` });
        setMeetingDate((current: string) => (current < earliest ? earliest : current));
        return;
      }
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
        setFieldErrors({ form: errorMessage(error) });
        toast.error(error.message);
        return;
      }
      toastApiError(error, "No fue posible crear la reserva.");
    },
  });

  if (!canCreateReservations(user)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <ShieldAlert className="mx-auto size-6 text-muted-foreground" />
        <h1 className="mt-2 font-display text-lg font-semibold">Sin permiso para reservar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tu rol solo permite consultar el calendario.
        </p>
      </div>
    );
  }

  function buildBody(force: boolean): CreateReservationBody {
    return {
      roomId,
      title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      meetingDate,
      startTime,
      endTime,
      inviteeEmails,
      force,
    };
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!roomId) errors["roomId"] = "Elige una sala.";
    if (title.trim().length < 3) errors["title"] = "Escribe un título.";
    if (!isValidTime(startTime)) errors["startTime"] = "Hora inválida (HH:mm).";
    if (!isValidTime(endTime)) errors["endTime"] = "Hora inválida (HH:mm).";
    if (isValidTime(startTime) && isValidTime(endTime) && toMinutes(endTime) <= toMinutes(startTime)) {
      errors["endTime"] = "La salida debe ser posterior a la entrada.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    createMutation.mutate(buildBody(false));
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="animate-rise">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Agenda
        </p>
        <h1 className="font-display text-2xl font-semibold text-foreground">Nueva reserva</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Se requiere mínimo un día de anticipación (hora de Bogotá).
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <Label>Sala</Label>
          {roomsQuery.isLoading ? (
            <Loader2 className="size-4 animate-spin text-accent" />
          ) : (
            <div className="grid gap-2">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => setRoomId(room.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.99]",
                    roomId === room.id
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-accent/40",
                  )}
                >
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: roomColorVar(rooms, room.id) }}
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{room.name}</span>
                    {room.locationNote && (
                      <span className="block text-xs text-muted-foreground">
                        {room.locationNote}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
          {fieldErrors["roomId"] && (
            <p className="text-xs text-destructive">{fieldErrors["roomId"]}</p>
          )}
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor="meetingDate">Fecha</Label>
            <Input
              id="meetingDate"
              type="date"
              min={minDate}
              value={meetingDate}
              onChange={(event) => setMeetingDate(event.target.value)}
            />
            <p className="text-xs text-muted-foreground capitalize">
              {formatLongDate(meetingDate)}
            </p>
            {fieldErrors["meetingDate"] && (
              <p className="text-xs text-destructive animate-pop">{fieldErrors["meetingDate"]}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startTime">Entrada</Label>
              <Input
                id="startTime"
                type="time"
                step={300}
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
              {fieldErrors["startTime"] && (
                <p className="text-xs text-destructive">{fieldErrors["startTime"]}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">Salida</Label>
              <Input
                id="endTime"
                type="time"
                step={300}
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
              {fieldErrors["endTime"] && (
                <p className="text-xs text-destructive">{fieldErrors["endTime"]}</p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Comité de calidad"
            />
            {fieldErrors["title"] && (
              <p className="text-xs text-destructive">{fieldErrors["title"]}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
          <InviteesField
            value={invitees}
            onChange={setInvitees}
            excludeEmail={user?.email}
          />
        </section>

        {fieldErrors["form"] && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {fieldErrors["form"]}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full hover-lift"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CalendarPlus className="size-4" />
          )}
          Confirmar reserva
        </Button>
      </form>

      <Dialog open={Boolean(conflict)} onOpenChange={(open) => !open && setConflict(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <AlertTriangle className="size-5 text-accent" />
              Sala ocupada
            </DialogTitle>
            <DialogDescription>{conflictMessage}</DialogDescription>
          </DialogHeader>

          <ul className="space-y-2">
            {conflict?.conflicts.map((item) => (
              <li key={item.id} className="rounded-xl border border-border bg-secondary p-3">
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {item.startTime}–{item.endTime} · {item.organizerName}
                </p>
              </li>
            ))}
          </ul>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConflict(null)}>
              Elegir otro horario
            </Button>
            {conflict?.canOverride && (
              <Button
                variant="destructive"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate(buildBody(true))}
              >
                {createMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ShieldAlert className="size-4" />
                )}
                Tomar la sala como gerencia
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
