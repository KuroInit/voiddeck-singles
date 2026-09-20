import { isFoil } from "@/lib/foil";
import { cn } from "@/lib/utils";

/**
 * Wrapper for card art: applies the stationary holo shimmer when the
 * printing exists as a foil variant, renders as a plain clipped box otherwise.
 * Shared by every surface that shows card art (cart, bundle, deck import,
 * sell preview, listing grid, detail page).
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
  return (
    <div className={cn("relative overflow-hidden", className, isFoil(cardCode) && "holo-sheen")}>
      {children}
    </div>
  );
}
