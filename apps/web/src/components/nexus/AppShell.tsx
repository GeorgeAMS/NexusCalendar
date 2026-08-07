import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarDays, LogOut, Plus, Users } from "lucide-react";
import type { ReactNode } from "react";

import { canCreateReservations, isAdmin, useAuth } from "@/lib/auth";
import { notificationsApi } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function BrandMark() {
  return (
    <Link to="/calendario" className="group flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-xl bg-[image:var(--gradient-accent)] text-navy-deep shadow-soft transition-transform duration-200 group-hover:rotate-6">
        <CalendarDays className="size-5" strokeWidth={2.5} />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-base font-semibold text-navy-foreground">
          Nexus Calendar
        </span>
        <span className="block text-[11px] text-navy-foreground/60">
          Clínica Regional del San Jorge
        </span>
      </span>
    </Link>
  );
}

type NavItem = { to: string; label: string; icon: typeof CalendarDays };

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationsApi.list({ unread: true, limit: 1 }),
    refetchInterval: 60_000,
    retry: false,
  });
  const unread = notifications?.unread ?? 0;

  const items: NavItem[] = [{ to: "/calendario", label: "Calendario", icon: CalendarDays }];
  if (canCreateReservations(user)) {
    items.push({ to: "/reservas/nueva", label: "Reservar", icon: Plus });
  }
  if (isAdmin(user)) {
    items.push({ to: "/admin/usuarios", label: "Usuarios", icon: Users });
  }
  items.push({ to: "/notificaciones", label: "Avisos", icon: Bell });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 bg-navy-deep/95 backdrop-blur supports-[backdrop-filter]:bg-navy-deep/85">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <BrandMark />
          <div className="flex items-center gap-1">
            <nav className="hidden items-center gap-1 md:flex">
              {items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeProps={{ className: "bg-navy-foreground/15 text-navy-foreground" }}
                  className="relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-navy-foreground/70 transition-colors hover:bg-navy-foreground/10 hover:text-navy-foreground"
                >
                  <item.icon className="size-4" />
                  {item.label}
                  {item.to === "/notificaciones" && unread > 0 && (
                    <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground">
                      {unread}
                    </span>
                  )}
                </Link>
              ))}
            </nav>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-navy-foreground/80 hover:bg-navy-foreground/10 hover:text-navy-foreground"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
        {user && (
          <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 pb-2 text-[11px] text-navy-foreground/60">
            <span className="truncate">{user.fullName}</span>
            <span className="rounded-full bg-navy-foreground/10 px-2 py-0.5 uppercase tracking-wide">
              {user.role}
            </span>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 md:pb-12">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-stretch justify-around">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "text-accent" }}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors active:scale-95",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
              {item.to === "/notificaciones" && unread > 0 && (
                <span className="absolute right-[22%] top-1 grid size-4 place-items-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground">
                  {unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
