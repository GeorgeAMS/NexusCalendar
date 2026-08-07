import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogIn } from "lucide-react";

import { AuthLayout } from "@/components/nexus/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api/endpoints";
import { errorCode, errorMessage } from "@/lib/api-errors";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Nexus Calendar" },
      {
        name: "description",
        content:
          "Reserva salas de reuniones de la Clínica Regional del San Jorge con Nexus Calendar.",
      },
      { property: "og:title", content: "Nexus Calendar — Reserva de salas" },
      {
        property: "og:description",
        content: "Agenda de salas de reuniones de la Clínica Regional del San Jorge.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { setSession, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;
    if (user.status !== "active") {
      void navigate({ to: "/pendiente", replace: true });
      return;
    }
    void navigate({ to: "/calendario", replace: true });
  }, [loading, user, navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const result = await authApi.login({ email: email.trim().toLowerCase(), password });
      setSession(result.accessToken, result.refreshToken, result.user);
      await navigate({ to: "/calendario", replace: true });
    } catch (error) {
      const code = errorCode(error);
      if (code === "ACCOUNT_PENDING") {
        await navigate({ to: "/pendiente", replace: true });
        return;
      }
      if (code === "ACCOUNT_REJECTED") {
        setFormError("Tu solicitud fue rechazada. Contacta al administrador de Nexus Calendar.");
        return;
      }
      if (code === "ACCOUNT_DISABLED") {
        setFormError("Tu cuenta está desactivada. Contacta al administrador para reactivarla.");
        return;
      }
      setFormError(errorMessage(error, "No fue posible iniciar sesión."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Salas de reuniones, sin choques de agenda."
      footer={
        <span>
          ¿No tienes cuenta?{" "}
          <Link to="/registro" className="font-semibold text-accent underline-offset-4 hover:underline">
            Solicita acceso
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Correo institucional</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="nombre@clinica.example"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {formError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive animate-pop"
          >
            {formError}
          </p>
        )}

        <Button type="submit" className="w-full hover-lift" size="lg" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}
