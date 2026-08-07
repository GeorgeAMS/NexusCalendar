import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Loader2, Search, ShieldAlert, UserMinus, UserX } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminApi } from "@/lib/api/endpoints";
import type { AuthUser, UserRole } from "@/lib/api/types";
import { toastApiError } from "@/lib/api-errors";
import { isAdmin, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuarios — Nexus Calendar" },
      {
        name: "description",
        content: "Aprueba solicitudes, asigna roles y desactiva cuentas de Nexus Calendar.",
      },
      { property: "og:title", content: "Usuarios — Nexus Calendar" },
      { property: "og:description", content: "Administración de cuentas de Nexus Calendar." },
      { property: "og:url", content: "/admin/usuarios" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/admin/usuarios" }],
  }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");

  const pendingQuery = useQuery({
    queryKey: ["admin", "users", "pending"],
    queryFn: () => adminApi.users({ status: "pending", pageSize: 50 }),
    enabled: isAdmin(user),
  });

  const activeQuery = useQuery({
    queryKey: ["admin", "users", "active", query],
    queryFn: () => adminApi.users({ status: "active", q: query || undefined, pageSize: 50 }),
    enabled: isAdmin(user),
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  const approve = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "usuario" | "gerencia" }) =>
      adminApi.approve(id, role),
    onSuccess: (updated) => {
      toast.success(`${updated.fullName} aprobado como ${updated.role}`);
      refresh();
    },
    onError: (error) => toastApiError(error),
  });

  const reject = useMutation({
    mutationFn: (id: string) => adminApi.reject(id),
    onSuccess: () => {
      toast("Solicitud rechazada");
      refresh();
    },
    onError: (error) => toastApiError(error),
  });

  const setRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "usuario" | "gerencia" }) =>
      adminApi.setRole(id, role),
    onSuccess: (updated) => {
      toast.success(`Rol actualizado a ${updated.role}`);
      refresh();
    },
    onError: (error) => toastApiError(error),
  });

  const disable = useMutation({
    mutationFn: (id: string) => adminApi.disable(id),
    onSuccess: () => {
      toast("Cuenta desactivada");
      refresh();
    },
    onError: (error) => toastApiError(error),
  });

  if (!isAdmin(user)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <ShieldAlert className="mx-auto size-6 text-muted-foreground" />
        <h1 className="mt-2 font-display text-lg font-semibold">Sección solo para administradores</h1>
      </div>
    );
  }

  const pending = pendingQuery.data?.items ?? [];
  const active = activeQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <header className="animate-rise">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Administración
        </p>
        <h1 className="font-display text-2xl font-semibold text-foreground">Usuarios</h1>
      </header>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold">
            Solicitudes pendientes
            {pending.length > 0 && (
              <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[11px] text-accent-foreground">
                {pending.length}
              </span>
            )}
          </h2>
          {pendingQuery.isFetching && <Loader2 className="size-4 animate-spin text-accent" />}
        </div>

        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No hay solicitudes por revisar.
          </p>
        ) : (
          <ul className="space-y-2">
            {pending.map((candidate, index) => (
              <li
                key={candidate.id}
                style={{ animationDelay: `${index * 40}ms` }}
                className="rounded-2xl border border-accent/40 bg-card p-4 shadow-soft animate-rise"
              >
                <UserSummary user={candidate} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => approve.mutate({ id: candidate.id, role: "usuario" })}
                    disabled={approve.isPending}
                  >
                    <Check className="size-4" />
                    Aprobar como usuario
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => approve.mutate({ id: candidate.id, role: "gerencia" })}
                    disabled={approve.isPending}
                  >
                    <Check className="size-4" />
                    Aprobar como gerencia
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => reject.mutate(candidate.id)}
                    disabled={reject.isPending}
                  >
                    <UserX className="size-4" />
                    Rechazar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-sm font-semibold">Cuentas activas</h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre o correo"
            className="pl-9"
          />
        </div>

        {activeQuery.isLoading ? (
          <div className="grid h-24 place-items-center">
            <Loader2 className="size-5 animate-spin text-accent" />
          </div>
        ) : (
          <ul className="space-y-2">
            {active.map((member) => (
              <li
                key={member.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-soft"
              >
                <UserSummary user={member} />
                {member.role !== "admin" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <RolePill
                      active={member.role === "usuario"}
                      onClick={() => setRole.mutate({ id: member.id, role: "usuario" })}
                    >
                      usuario
                    </RolePill>
                    <RolePill
                      active={member.role === "gerencia"}
                      onClick={() => setRole.mutate({ id: member.id, role: "gerencia" })}
                    >
                      gerencia
                    </RolePill>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-destructive"
                      onClick={() => disable.mutate(member.id)}
                      disabled={disable.isPending}
                    >
                      <UserMinus className="size-4" />
                      Desactivar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function UserSummary({ user }: { user: AuthUser }) {
  return (
    <div>
      <p className="text-sm font-semibold">{user.fullName}</p>
      <p className="text-xs text-muted-foreground">{user.email}</p>
      {user.phone && <p className="text-xs text-muted-foreground">Tel. {user.phone}</p>}
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {user.status}
        {user.role ? ` · ${user.role satisfies UserRole | null}` : ""}
      </p>
    </div>
  );
}

function RolePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-all active:scale-95",
        active
          ? "border-accent bg-accent/12 text-foreground"
          : "border-border text-muted-foreground hover:border-accent/40",
      )}
    >
      {children}
    </button>
  );
}
