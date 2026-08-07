import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { z } from "zod";

import { AuthLayout } from "@/components/nexus/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "@/lib/api/endpoints";
import { errorCode, errorMessage } from "@/lib/api-errors";

export const Route = createFileRoute("/registro")({
  head: () => ({
    meta: [
      { title: "Solicitar acceso — Nexus Calendar" },
      {
        name: "description",
        content:
          "Crea tu solicitud de cuenta en Nexus Calendar, la agenda de salas de la Clínica Regional del San Jorge.",
      },
      { property: "og:title", content: "Solicitar acceso — Nexus Calendar" },
      {
        property: "og:description",
        content: "Registra tu cuenta y espera la aprobación del administrador.",
      },
      { property: "og:url", content: "/registro" },
    ],
    links: [{ rel: "canonical", href: "/registro" }],
  }),
  component: RegisterPage,
});

const schema = z.object({
  fullName: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
  email: z.string().trim().email("Correo inválido.").max(255),
  phone: z.string().trim().min(7, "Teléfono inválido.").max(20),
  password: z.string().min(8, "Mínimo 8 caracteres.").max(72),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof schema>, string>>;

function RegisterPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof values, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      // El registro NO devuelve tokens: la cuenta queda pendiente de aprobación.
      await authApi.register({
        fullName: parsed.data.fullName,
        email: parsed.data.email.toLowerCase(),
        phone: parsed.data.phone,
        password: parsed.data.password,
      });
      await navigate({ to: "/pendiente", replace: true });
    } catch (error) {
      if (errorCode(error) === "EMAIL_TAKEN") {
        setErrors((prev) => ({
          ...prev,
          email: errorMessage(error, "Este correo ya está registrado."),
        }));
      } else {
        setFormError(errorMessage(error, "No fue posible crear la solicitud."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Solicitar acceso"
      subtitle="Un administrador revisará tu solicitud."
      footer={
        <span>
          ¿Ya tienes cuenta?{" "}
          <Link to="/" className="font-semibold text-accent underline-offset-4 hover:underline">
            Inicia sesión
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input
            id="fullName"
            value={values.fullName}
            onChange={(event) => update("fullName", event.target.value)}
            autoComplete="name"
          />
          {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Correo institucional</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={(event) => update("email", event.target.value)}
            placeholder="nombre@clinica.example"
          />
          {errors.email && (
            <p className="text-xs text-destructive animate-pop">{errors.email}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(event) => update("phone", event.target.value)}
            placeholder="3001234567"
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(event) => update("password", event.target.value)}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>

        {formError && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        )}

        <Button type="submit" className="w-full hover-lift" size="lg" disabled={submitting}>
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <UserPlus className="size-4" />
          )}
          Enviar solicitud
        </Button>
      </form>
    </AuthLayout>
  );
}
