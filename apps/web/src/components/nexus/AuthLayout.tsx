import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { NexusLogo3D } from "./NexusLogo3D";

/**
 * Soft brand lights that drift with the pointer — HakiPOS-style atmosphere.
 * Ignores form focus/typing; only pointer position drives the glow.
 */
function useAmbientLights(enabled: boolean) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const glowWarmRef = useRef<HTMLDivElement | null>(null);
  const glowCoolRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const target = { x: 0.5, y: 0.35 };
    const current = { x: 0.5, y: 0.35 };
    let frame = 0;

    function onPointerMove(event: PointerEvent) {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      target.x = (event.clientX - rect.left) / rect.width;
      target.y = (event.clientY - rect.top) / rect.height;
    }

    function tick() {
      frame = requestAnimationFrame(tick);
      current.x += (target.x - current.x) * 0.07;
      current.y += (target.y - current.y) * 0.07;

      const warm = glowWarmRef.current;
      const cool = glowCoolRef.current;
      if (warm) {
        warm.style.left = `${(current.x * 100).toFixed(2)}%`;
        warm.style.top = `${(current.y * 100).toFixed(2)}%`;
      }
      if (cool) {
        // Cool light sits opposite for depth — classic dual-key look.
        cool.style.left = `${((1 - current.x) * 100).toFixed(2)}%`;
        cool.style.top = `${((1 - current.y * 0.65) * 100).toFixed(2)}%`;
      }
    }

    const stage = stageRef.current;
    stage?.addEventListener("pointermove", onPointerMove, { passive: true });
    tick();

    return () => {
      cancelAnimationFrame(frame);
      stage?.removeEventListener("pointermove", onPointerMove);
    };
  }, [enabled]);

  return { stageRef, glowWarmRef, glowCoolRef };
}

const AUTH_BG = "oklch(0.19 0.055 261)";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [motionOk, setMotionOk] = useState(false);
  useEffect(() => {
    setMotionOk(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const { stageRef, glowWarmRef, glowCoolRef } = useAmbientLights(motionOk);

  useLayoutEffect(() => {
    const prevBody = document.body.style.backgroundColor;
    const prevHtml = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = AUTH_BG;
    document.documentElement.style.backgroundColor = AUTH_BG;
    return () => {
      document.body.style.backgroundColor = prevBody;
      document.documentElement.style.backgroundColor = prevHtml;
    };
  }, []);

  return (
    <div ref={stageRef} className="relative flex min-h-screen flex-col overflow-hidden surface-hero">
      {/* Atmospheric lights — pointer-driven, never tied to inputs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          ref={glowWarmRef}
          className="absolute size-[min(70vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
          style={{
            left: "50%",
            top: "35%",
            background:
              "radial-gradient(circle, oklch(0.68 0.176 48 / 0.45) 0%, oklch(0.68 0.176 48 / 0.12) 42%, transparent 70%)",
          }}
        />
        <div
          ref={glowCoolRef}
          className="absolute size-[min(65vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
          style={{
            left: "50%",
            top: "70%",
            background:
              "radial-gradient(circle, oklch(0.45 0.12 258 / 0.55) 0%, oklch(0.32 0.09 259 / 0.2) 45%, transparent 72%)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,oklch(0.3_0.08_258_/_0.25),transparent_55%)]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-[420px]">
          <header className="mb-8 text-center animate-rise">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-navy-foreground/60">
              Clínica Regional del San Jorge
            </p>

            <div className="mx-auto mt-3 w-full max-w-[300px] sm:max-w-[340px]">
              <NexusLogo3D variant="hero" className="h-[168px] sm:h-[196px]" />
            </div>

            <h1 className="sr-only">Nexus Calendar</h1>
            <p className="mt-3 text-sm leading-relaxed text-navy-foreground/70">{subtitle}</p>
          </header>

          <div className="rounded-3xl border border-navy-foreground/10 bg-card/95 p-6 shadow-lift backdrop-blur-md animate-pop sm:p-7">
            <h2 className="font-display text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            <div className="mt-5">{children}</div>
          </div>

          {footer && (
            <div className="mt-6 text-center text-sm text-navy-foreground/70">{footer}</div>
          )}
        </div>
      </div>
    </div>
  );
}
