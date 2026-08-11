import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy, useState } from "react";

import { cn } from "@/lib/utils";

const NexusLogoScene = lazy(() => import("./NexusLogoScene"));

type Variant = "hero" | "mark";

function LogoFallback({ variant, className }: { variant: Variant; className?: string }) {
  return (
    <img
      src="/brand/nexus-logo.png"
      alt=""
      aria-hidden
      className={cn(
        "h-full w-full object-contain",
        /* Black studio plate disappears against navy / sidebar. */
        variant === "hero" ? "mix-blend-lighten" : "mix-blend-screen",
        className,
      )}
    />
  );
}

/** Nearly-static Nexus logo via Three.js. Never renders during SSR. */
export function NexusLogo3D({
  variant = "hero",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  const [sceneReady, setSceneReady] = useState(false);

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
      {/* Always under the canvas so reloads never flash a black matte. */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          sceneReady ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        <LogoFallback variant={variant} />
      </div>

      <ClientOnly fallback={null}>
        <Suspense fallback={null}>
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-300",
              sceneReady ? "opacity-100" : "opacity-0",
              variant === "hero" ? "mix-blend-lighten" : "mix-blend-screen",
            )}
          >
            <NexusLogoScene variant={variant} onReady={() => setSceneReady(true)} />
          </div>
        </Suspense>
      </ClientOnly>
    </div>
  );
}
