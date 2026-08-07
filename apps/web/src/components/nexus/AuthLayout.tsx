import { Hero3D } from "./Hero3D";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col surface-hero">
      <Hero3D className="opacity-45" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,color-mix(in_oklab,var(--navy-deep)_72%,transparent),transparent_75%)]" />
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center animate-rise">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-navy-foreground/60">
              Clínica Regional del San Jorge
            </p>
            <h1 className="mt-2 font-display text-4xl font-semibold text-navy-foreground">
              Nexus <span className="text-gradient-accent">Calendar</span>
            </h1>
            <p className="mt-2 text-sm text-navy-foreground/70">{subtitle}</p>
          </div>
          <div
            className="rounded-3xl border border-navy-foreground/10 bg-card/95 p-6 shadow-lift backdrop-blur animate-pop"
            style={{ animationDelay: "80ms" }}
          >
            <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
            <div className="mt-4">{children}</div>
          </div>
          {footer && (
            <div className="mt-5 text-center text-sm text-navy-foreground/70">{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}
