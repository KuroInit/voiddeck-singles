import { isFoil } from "@/lib/foil";
import { cn } from "@/lib/utils";

/**
 * Wrapper for card art, mirroring Bilgewater Market's foil rendering: the art
 * is brightened/saturated, a slow rainbow light band sweeps over it (screen
 * blend), and a stationary sparkle layer hue-rotates in place (color-dodge
 * blend). Applied only when the market data shows the printing exists as a
 * foil variant; renders as a plain clipped box otherwise.
 */
export function FoilArt({
  cardCode,
  className,
  children,
}: {
  cardCode: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const foil = isFoil(cardCode);
  return (
    <div className={cn("relative isolate overflow-hidden", className, foil && "holo-card")}>
      {children}
      {foil ? (
        <>
          <div
            aria-hidden
            className="holo-band pointer-events-none absolute inset-0"
            style={{ mixBlendMode: "screen", opacity: 0.45 }}
          />
          <div
            aria-hidden
            className="holo-static pointer-events-none absolute inset-0"
            style={{ mixBlendMode: "color-dodge", opacity: 0.29 }}
          />
        </>
      ) : null}
    </div>
  );
}
