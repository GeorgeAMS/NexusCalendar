import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarDays, LogOut, Plus, UserRound, Users } from "lucide-react";
import type { ReactNode } from "react";

import { canCreateReservations, isAdmin, useAuth } from "@/lib/auth";
import { notificationsApi } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NexusLogo3D } from "./NexusLogo3D";

function BrandMark() {
  return (
    <Link to="/calendario" className="group flex items-center gap-2.5">
      <span className="relative shrink-0">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -m-1 rounded-xl bg-accent/25 blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
        <NexusLogo3D
          variant="mark"
          className="relative transition-transform duration-300 group-hover:scale-105"
        />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-base font-semibold text-navy-foreground transition-colors duration-200 group-hover:text-white">
          Nexus Calendar
        </span>
        <span className="block text-[11px] text-navy-foreground/60 transition-colors duration-200 group-hover:text-navy-foreground/80">
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
  items.push({ to: "/cuenta", label: "Cuenta", icon: UserRound });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="relative flex min-h-screen flex-col surface-app">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-[10%] top-[18%] size-[42vmin] rounded-full bg-[oklch(0.55_0.12_250_/0.1)] blur-3xl animate-orb-drift" />
        <div
          className="absolute -right-[8%] top-[42%] size-[36vmin] rounded-full bg-accent/10 blur-3xl animate-orb-drift"
          style={{ animationDelay: "-5s" }}
        />
        <div
          className="absolute left-[35%] bottom-[-8%] size-[48vmin] rounded-full bg-[oklch(0.4_0.08_258_/0.08)] blur-3xl animate-orb-drift"
          style={{ animationDelay: "-10s" }}
        />
      </div>

      <header className="sticky top-0 z-40 overflow-hidden border-b border-white/10 shadow-soft surface-header animate-sheen">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-accent/20 blur-3xl animate-glow-pulse"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-10 bottom-[-40%] size-40 rounded-full bg-[oklch(0.55_0.12_250_/0.35)] blur-3xl animate-glow-pulse"
          style={{ animationDelay: "1.6s" }}
        />

        <div className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <BrandMark />
          <div className="flex items-center gap-1">
            <nav className="hidden items-center gap-1 md:flex">
              {items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  activeProps={{
                    className: "bg-navy-foreground/12 text-navy-foreground",
                  }}
                  className="nav-chip flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-navy-foreground/70 hover:bg-navy-foreground/10 hover:text-navy-foreground"
                >
                  <item.icon className="size-4 transition-transform duration-200 group-hover:scale-110" />
                  {item.label}
                  {item.to === "/notificaciones" && unread > 0 && (
                    <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-foreground animate-glow-pulse">
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
              className="text-navy-foreground/80 transition-colors duration-200 hover:bg-navy-foreground/10 hover:text-navy-foreground"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Salir</span>
            </Button>
          </div>
        </div>
        {user && (
          <div className="relative mx-auto flex w-full max-w-5xl items-center gap-2 px-4 pb-2 text-[11px] text-navy-foreground/65">
            <Link
              to="/cuenta"
              className="truncate transition-colors hover:text-navy-foreground"
            >
              {user.fullName}
            </Link>
            <span className="rounded-full border border-accent/30 bg-accent/15 px-2 py-0.5 font-semibold uppercase tracking-wide text-accent">
              {user.role}
            </span>
          </div>
        )}
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-5 md:pb-12">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/90 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-18px_oklch(0.24_0.055_258_/_0.35)] backdrop-blur md:hidden">
        <div className="mx-auto flex max-w-5xl items-stretch justify-around">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeProps={{ className: "text-accent" }}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium text-muted-foreground transition-all duration-200 active:scale-95",
                "hover:text-foreground",
              )}
            >
              <item.icon className="size-5 transition-transform duration-200" />
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
