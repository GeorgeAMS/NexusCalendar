import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import { cn } from "@/lib/utils";

const NexusLogoScene = lazy(() => import("./NexusLogoScene"));

type Variant = "hero" | "mark";

function LogoFallback({ variant }: { variant: Variant }) {
  return (
    <img
      src="/brand/nexus-logo.png"
      alt=""
      aria-hidden
      className={cn("h-full w-full object-contain", variant === "hero" && "mix-blend-lighten")}
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
      <ClientOnly fallback={<LogoFallback variant={variant} />}>
        <Suspense fallback={<LogoFallback variant={variant} />}>
          <NexusLogoScene variant={variant} />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
