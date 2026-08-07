import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Mail, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usersApi } from "@/lib/api/endpoints";
import type { DirectoryUser } from "@/lib/api/types";
export type InviteDraft = {
  email: string;
  fullName?: string | undefined;
  userId?: string | undefined;
  source: "profile" | "email";
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

type InviteesFieldProps = {
  value: InviteDraft[];
  onChange: (next: InviteDraft[]) => void;
  /** Correo del organizador para no auto-invitarse por error (opcional). */
  excludeEmail?: string | undefined;
};

export function InviteesField({ value, onChange, excludeEmail }: InviteesFieldProps) {
  const [profileQuery, setProfileQuery] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(profileQuery.trim());

  const directoryQuery = useQuery({
    queryKey: ["users", "directory", deferredQuery],
    queryFn: () => usersApi.directory({ q: deferredQuery || undefined, limit: 20 }),
  });

  const selectedEmails = useMemo(
    () => new Set(value.map((item) => item.email)),
    [value],
  );

  const profiles = useMemo(() => {
    const items = directoryQuery.data?.items ?? [];
    const excluded = excludeEmail ? normalizeEmail(excludeEmail) : null;
    return items.filter((user) => {
      const email = normalizeEmail(user.email);
      if (selectedEmails.has(email)) return false;
      if (excluded && email === excluded) return false;
      return true;
    });
  }, [directoryQuery.data, excludeEmail, selectedEmails]);

  function addProfile(user: DirectoryUser) {
    const email = normalizeEmail(user.email);
    if (selectedEmails.has(email)) return;
    onChange([
      ...value,
      {
        email,
        fullName: user.fullName,
        userId: user.id,
        source: "profile",
      },
    ]);
    setProfileQuery("");
  }

  function addEmail() {
    const email = normalizeEmail(emailDraft);
    if (!email) {
      setEmailError(null);
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setEmailError("Escribe un correo válido.");
      return;
    }
    if (excludeEmail && email === normalizeEmail(excludeEmail)) {
      setEmailError("No hace falta invitarte a ti mismo.");
      return;
    }
    if (selectedEmails.has(email)) {
      setEmailError("Ese correo ya está en la lista.");
      return;
    }
    onChange([...value, { email, source: "email" }]);
    setEmailDraft("");
    setEmailError(null);
  }

  function remove(email: string) {
    onChange(value.filter((item) => item.email !== email));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Invitados</Label>
        <p className="text-xs text-muted-foreground">
          Elige un perfil registrado o escribe un correo a mano.
        </p>
      </div>

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((item) => (
            <li
              key={item.email}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs"
            >
              {item.source === "profile" ? (
                <UserRound className="size-3 shrink-0 text-accent" />
              ) : (
                <Mail className="size-3 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate font-medium">
                {item.fullName ?? item.email}
              </span>
              {item.fullName && (
                <span className="truncate text-muted-foreground">{item.email}</span>
              )}
              <button
                type="button"
                onClick={() => remove(item.email)}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label={`Quitar ${item.fullName ?? item.email}`}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <Label htmlFor="invite-profile" className="text-xs text-muted-foreground">
          Por perfil
        </Label>
        <Input
          id="invite-profile"
          value={profileQuery}
          onChange={(event) => {
            setProfileQuery(event.target.value);
            setProfileOpen(true);
          }}
          onFocus={() => setProfileOpen(true)}
          onBlur={() => {
            // Espera al click de un resultado antes de cerrar.
            window.setTimeout(() => setProfileOpen(false), 150);
          }}
          placeholder="Buscar por nombre o correo…"
          autoComplete="off"
        />
        {profileOpen && (
          <div className="max-h-44 overflow-y-auto rounded-xl border border-border bg-background">
            {directoryQuery.isFetching && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                Buscando…
              </div>
            )}
            {!directoryQuery.isFetching && profiles.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {deferredQuery
                  ? "No hay perfiles activos con esa búsqueda. Puedes invitar por correo abajo."
                  : "No hay más perfiles disponibles."}
              </p>
            ) : (
              <ul>
                {profiles.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => addProfile(user)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary"
                    >
                      <UserRound className="size-4 shrink-0 text-accent" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {user.fullName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="invite-email" className="text-xs text-muted-foreground">
          Por correo
        </Label>
        <div className="flex gap-2">
          <Input
            id="invite-email"
            type="email"
            value={emailDraft}
            onChange={(event) => {
              setEmailDraft(event.target.value);
              if (emailError) setEmailError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addEmail();
              }
            }}
            placeholder="nombre@clinica.example"
            autoComplete="off"
          />
          <Button type="button" variant="outline" onClick={addEmail}>
            Añadir
          </Button>
        </div>
        {emailError && <p className="text-xs text-destructive">{emailError}</p>}
      </div>

      <p className="text-xs text-muted-foreground">
        {value.length} invitado{value.length === 1 ? "" : "s"}. Los perfiles reciben
        correo e inbox; los correos externos solo email.
      </p>
    </div>
  );
}

export function inviteEmailsFromDrafts(drafts: InviteDraft[]): string[] {
  return drafts.map((item) => item.email);
}
