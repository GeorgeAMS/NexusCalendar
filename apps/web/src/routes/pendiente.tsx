import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Clock3, LogOut, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AuthLayout } from "@/components/nexus/AuthLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/pendiente")({
  head: () => ({
    meta: [
      { title: "Cuenta en revisión — Nexus Calendar" },
      {
        name: "description",
        content: "Tu solicitud de acceso a Nexus Calendar está en revisión por un administrador.",
      },
      { property: "og:title", content: "Cuenta en revisión — Nexus Calendar" },
      { property: "og:description", content: "Espera la aprobación del administrador." },
      { property: "og:url", content: "/pendiente" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "/pendiente" }],
  }),
  component: PendingPage,
});

function PendingPage() {
  const { user, refreshUser, signOut } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const rejected = user?.status === "rejected";
  const disabled = user?.status === "disabled";
  // Tras registro o ACCOUNT_PENDING el API no entrega tokens: no hay sesión para /auth/me.
  const hasSession = Boolean(user);

  async function check() {
    if (!hasSession) {
      toast("Cuando te aprueben, inicia sesión con tu correo y contraseña.");
      await navigate({ to: "/", replace: true });
      return;
    }

    setChecking(true);
    const me = await refreshUser();
    setChecking(false);
    if (me?.status === "active") {
      toast.success("Tu cuenta fue aprobada");
      await navigate({ to: "/calendario", replace: true });
    } else {
      toast("Tu cuenta sigue en revisión");
    }
  }

  function leave() {
    signOut();
    void navigate({ to: "/", replace: true });
  }

  return (
    <AuthLayout
      title={
        rejected ? "Solicitud rechazada" : disabled ? "Cuenta desactivada" : "Solicitud en revisión"
      }
      subtitle="Acceso controlado por el administrador."
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-secondary p-4">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent animate-float">
            <Clock3 className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">
            {rejected
              ? "Tu solicitud fue rechazada. Comunícate con el administrador de Nexus Calendar si crees que es un error."
              : disabled
                ? "Tu cuenta fue desactivada. Comunícate con el administrador para reactivarla."
                : hasSession
                  ? "Un administrador debe aprobar tu cuenta y asignarte un rol. Recibirás un correo cuando esté lista."
                  : "Tu solicitud quedó registrada. Cuando el administrador te apruebe, inicia sesión con el mismo correo y contraseña. También recibirás un correo de confirmación."}
          </p>
        </div>

        {!rejected && !disabled && (
          <Button onClick={check} className="w-full hover-lift" disabled={checking}>
            <RefreshCw className={checking ? "size-4 animate-spin" : "size-4"} />
            {hasSession ? "Verificar estado" : "Ir a iniciar sesión"}
          </Button>
        )}

        <Button variant="outline" className="w-full" onClick={leave}>
          <LogOut className="size-4" />
          Volver al inicio
        </Button>
      </div>
    </AuthLayout>
  );
}
