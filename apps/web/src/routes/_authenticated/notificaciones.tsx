import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, BellRing, CheckCheck, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { notificationsApi } from "@/lib/api/endpoints";
import { toastApiError } from "@/lib/api-errors";
import { disablePush, enablePush, pushSupported } from "@/lib/push";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notificaciones")({
  head: () => ({
    meta: [
      { title: "Mis notificaciones — Nexus Calendar" },
      {
        name: "description",
        content: "Avisos de invitaciones, cancelaciones y cambios en tus reservas de sala.",
      },
      { property: "og:title", content: "Mis notificaciones — Nexus Calendar" },
      { property: "og:description", content: "Buzón de avisos de Nexus Calendar." },
      { property: "og:url", content: "/notificaciones" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/notificaciones" }],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const [pushBusy, setPushBusy] = useState(false);
  const [pushState, setPushState] = useState<"idle" | "on" | "email-only">("idle");

  const notificationsQuery = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => notificationsApi.list({ limit: 50 }),
  });

  const markRead = useMutation({
    mutationFn: (ids?: string[]) => notificationsApi.markRead(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error) => toastApiError(error),
  });

  async function togglePush() {
    setPushBusy(true);
    try {
      if (pushState === "on") {
        await disablePush();
        setPushState("idle");
        toast("Notificaciones push desactivadas");
      } else {
        const result = await enablePush();
        if (result === "no-vapid") {
          setPushState("email-only");
          toast("Este servidor no tiene push configurado", {
            description: "Seguirás recibiendo los avisos por correo y en este buzón.",
          });
        } else if (result === "denied") {
          toast.error("El navegador bloqueó las notificaciones");
        } else {
          setPushState("on");
          toast.success("Notificaciones push activadas");
        }
      }
    } catch (error) {
      toastApiError(error, "No fue posible cambiar las notificaciones push.");
    } finally {
      setPushBusy(false);
    }
  }

  const items = notificationsQuery.data?.items ?? [];
  const unread = notificationsQuery.data?.unread ?? 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3 animate-rise">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Buzón
          </p>
          <h1 className="font-display text-2xl font-semibold text-foreground">
            Mis notificaciones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unread} sin leer de {items.length}
          </p>
        </div>
        {unread > 0 && (
          <Button variant="outline" onClick={() => markRead.mutate(undefined)}>
            <CheckCheck className="size-4" />
            Marcar todo leído
          </Button>
        )}
      </header>

      <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent">
          {pushState === "on" ? (
            <BellRing className="size-5 animate-float" />
          ) : pushState === "email-only" ? (
            <MailCheck className="size-5" />
          ) : (
            <Bell className="size-5" />
          )}
        </span>
        <div className="flex-1">
          <p className="text-sm font-medium">Avisos en el celular</p>
          <p className="text-xs text-muted-foreground">
            {pushState === "email-only"
              ? "Push no disponible en este servidor: solo correo y buzón."
              : "Recibe invitaciones y cambios aunque la app esté cerrada."}
          </p>
        </div>
        <Button
          variant={pushState === "on" ? "outline" : "default"}
          size="sm"
          onClick={togglePush}
          disabled={pushBusy || !pushSupported() || pushState === "email-only"}
        >
          {pushBusy && <Loader2 className="size-4 animate-spin" />}
          {pushState === "on" ? "Desactivar" : "Activar"}
        </Button>
      </section>

      {notificationsQuery.isLoading ? (
        <div className="grid h-32 place-items-center rounded-2xl border border-border bg-card">
          <Loader2 className="size-5 animate-spin text-accent" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Todavía no tienes avisos.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li
              key={item.id}
              style={{ animationDelay: `${Math.min(index * 35, 250)}ms` }}
              className={cn(
                "rounded-2xl border bg-card p-4 shadow-soft transition-colors animate-rise",
                item.readAt ? "border-border" : "border-accent/50",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                </div>
                {!item.readAt && (
                  <button
                    type="button"
                    onClick={() => markRead.mutate([item.id])}
                    className="shrink-0 rounded-full bg-accent/12 px-2 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/20"
                  >
                    Marcar leído
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
