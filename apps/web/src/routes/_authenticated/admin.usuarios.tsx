import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Check, Loader2, Plus, Search, ShieldAlert, UserMinus, UserX } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

  const [createOpen, setCreateOpen] = useState(false);

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
      <header className="flex flex-wrap items-end justify-between gap-3 animate-rise">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Administración
          </p>
          <h1 className="font-display text-2xl font-semibold text-foreground">Usuarios</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          Crear usuario
        </Button>
      </header>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refresh}
      />

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

function CreateUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const empty = {
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "usuario" as "usuario" | "gerencia",
  };
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof empty, string>>>({});

  const schema = z
    .object({
      fullName: z.string().trim().min(3, "Escribe el nombre completo.").max(120),
      email: z.string().trim().email("Correo inválido.").max(180),
      phone: z.string().trim().min(7, "Teléfono inválido.").max(20),
      password: z.string().min(8, "Mínimo 8 caracteres.").max(72),
      confirmPassword: z.string().min(1, "Confirma la contraseña."),
      role: z.enum(["usuario", "gerencia"]),
    })
    .refine((value) => value.password === value.confirmPassword, {
      message: "Las contraseñas no coinciden.",
      path: ["confirmPassword"],
    });

  const create = useMutation({
    mutationFn: () =>
      adminApi.create({
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        password: values.password,
        role: values.role,
      }),
    onSuccess: (created) => {
      toast.success(`${created.fullName} creado como ${created.role}`);
      setValues(empty);
      setErrors({});
      onOpenChange(false);
      onCreated();
    },
    onError: (error) => toastApiError(error, "No fue posible crear el usuario."),
  });

  function update<K extends keyof typeof empty>(field: K, value: (typeof empty)[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof typeof empty, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in next)) {
          next[key as keyof typeof empty] = issue.message;
        }
      }
      setErrors(next);
      return;
    }
    setErrors({});
    create.mutate();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setValues(empty);
          setErrors({});
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear usuario</DialogTitle>
          <DialogDescription>
            La cuenta queda activa de inmediato. Entrega la contraseña a la persona.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="create-fullName">Nombre completo</Label>
            <Input
              id="create-fullName"
              value={values.fullName}
              onChange={(event) => update("fullName", event.target.value)}
            />
            {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-email">Correo</Label>
            <Input
              id="create-email"
              type="email"
              autoComplete="off"
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-phone">Teléfono</Label>
            <Input
              id="create-phone"
              type="tel"
              value={values.phone}
              onChange={(event) => update("phone", event.target.value)}
            />
            {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-password">Contraseña</Label>
            <Input
              id="create-password"
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(event) => update("password", event.target.value)}
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-confirm">Confirmar contraseña</Label>
            <Input
              id="create-confirm"
              type="password"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={(event) => update("confirmPassword", event.target.value)}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Rol</Label>
            <RadioGroup
              value={values.role}
              onValueChange={(value) => update("role", value as "usuario" | "gerencia")}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="usuario" id="role-usuario" />
                Usuario
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="gerencia" id="role-gerencia" />
                Gerencia
              </label>
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending} className="w-full sm:w-auto">
              {create.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creando…
                </>
              ) : (
                "Crear cuenta"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
