import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api/endpoints";
import { toastApiError } from "@/lib/api-errors";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/cuenta")({
  head: () => ({
    meta: [
      { title: "Mi cuenta — Nexus Calendar" },
      {
        name: "description",
        content: "Consulta tu perfil y cambia la contraseña de Nexus Calendar.",
      },
      { property: "og:title", content: "Mi cuenta — Nexus Calendar" },
      { property: "og:description", content: "Perfil y cambio de contraseña." },
      { property: "og:url", content: "/cuenta" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/cuenta" }],
  }),
  component: AccountPage,
});

const schema = z
  .object({
    currentPassword: z.string().min(1, "Indica tu contraseña actual."),
    newPassword: z.string().min(8, "Mínimo 8 caracteres.").max(72),
    confirmPassword: z.string().min(1, "Confirma la nueva contraseña."),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "La nueva contraseña debe ser distinta a la actual.",
    path: ["newPassword"],
  });

function AccountPage() {
  const { user } = useAuth();
  const [values, setValues] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({});

  const changePassword = useMutation({
    mutationFn: () =>
      authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setErrors({});
      toast.success("Contraseña actualizada");
    },
    onError: (error) => toastApiError(error, "No fue posible cambiar la contraseña."),
  });

  function update(field: keyof typeof values, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: Partial<Record<keyof typeof values, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in next)) {
          next[key as keyof typeof values] = issue.message;
        }
      }
      setErrors(next);
      return;
    }
    setErrors({});
    changePassword.mutate();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-rise">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Cuenta
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-foreground">Mi perfil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Datos de tu sesión y cambio de contraseña.
        </p>
      </div>

      {user && (
        <div className="space-y-2 rounded-2xl border border-border/80 bg-card/80 p-4 shadow-soft">
          <p className="font-medium text-foreground">{user.fullName}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          {user.role && (
            <p className="text-xs uppercase tracking-wide text-accent">{user.role}</p>
          )}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-border/80 bg-card/80 p-4 shadow-soft sm:p-5"
      >
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-accent" />
          <h2 className="font-display text-lg font-semibold">Cambiar contraseña</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Usa al menos 8 caracteres. La sesión actual se mantiene activa.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Contraseña actual</Label>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={(event) => update("currentPassword", event.target.value)}
          />
          {errors.currentPassword && (
            <p className="text-xs text-destructive">{errors.currentPassword}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Nueva contraseña</Label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            value={values.newPassword}
            onChange={(event) => update("newPassword", event.target.value)}
          />
          {errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(event) => update("confirmPassword", event.target.value)}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword}</p>
          )}
        </div>

        <Button type="submit" disabled={changePassword.isPending} className="w-full sm:w-auto">
          {changePassword.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Guardando…
            </>
          ) : (
            "Guardar contraseña"
          )}
        </Button>
      </form>
    </div>
  );
}
