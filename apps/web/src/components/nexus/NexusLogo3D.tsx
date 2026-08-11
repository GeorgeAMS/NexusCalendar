import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useState } from "react";

import { cn } from "@/lib/utils";

const NexusLogoScene = lazy(() => import("./NexusLogoScene"));

const LOGO_SRC = "/brand/nexus-logo-transparent.png";

type Variant = "hero" | "mark";

function LogoImage({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt=""
      aria-hidden
      className={cn("h-full w-full object-contain", className)}
    />
  );
}

/** Nexus logo. Hero is a transparent PNG (no mix-blend / WebGL). */
export function NexusLogo3D({
  variant = "hero",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  const [sceneReady, setSceneReady] = useState(false);
  const useWebGl = variant === "mark";

  return (
    <div
      className={cn(
        "relative",
        variant === "hero" ? "h-48 w-full sm:h-56" : "size-12",
        className,
      )}
      role="img"
      aria-label="Nexus Calendar"
    >
      <div
        className={cn(
          "absolute inset-0",
          useWebGl && sceneReady ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        <LogoImage />
      </div>

      {useWebGl ? (
        <ClientOnly fallback={null}>
          <Suspense fallback={null}>
            <div
              className={cn(
                "absolute inset-0 transition-opacity duration-300",
                sceneReady ? "opacity-100" : "opacity-0",
              )}
            >
              <NexusLogoScene variant={variant} onReady={() => setSceneReady(true)} />
            </div>
          </Suspense>
        </ClientOnly>
      ) : null}
    </div>
  );
}
