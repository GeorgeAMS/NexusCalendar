import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

const NexusScene = lazy(() => import("./NexusScene"));

function SceneFallback() {
  return (
    <div className="h-full w-full bg-[radial-gradient(circle_at_60%_40%,color-mix(in_oklab,var(--accent)_28%,transparent),transparent_62%)]" />
  );
}

/** Decorative 3D hero backdrop. Never renders during SSR. */
export function Hero3D({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <ClientOnly fallback={<SceneFallback />}>
        <Suspense fallback={<SceneFallback />}>
          <NexusScene />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
