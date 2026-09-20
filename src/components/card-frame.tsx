import { cn } from "@/lib/utils";

// Rarity → SVG color language, matching src/lib/rarity.ts chip classes:
// common zinc, uncommon sky, rare violet, epic fuchsia, showcase amber.
const RARITY_STOPS: Record<string, [string, string]> = {
  common: ["#3f3f46", "#18181b"],
  uncommon: ["#0c4a6e", "#082f49"],
  rare: ["#4c1d95", "#2e1065"],
  epic: ["#701a75", "#4a044e"],
  showcase: ["#b45309", "#78350f"],
};

export function CardFrame({
  name,
  rarity,
  className,
}: {
  name: string;
  rarity?: string | null;
  className?: string;
}) {
  const key = (rarity ?? "").toLowerCase();
  const [stopTop, stopBottom] = RARITY_STOPS[key] ?? RARITY_STOPS.common;
  const gradientId = `cardframe-grad-${key || "common"}`;
  return (
    <svg
      viewBox="0 0 744 1039"
      role="img"
      aria-label={name}
      className={cn("aspect-[744/1039] w-full rounded-lg", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor={stopTop} />
          <stop offset="100%" stopColor={stopBottom} />
        </linearGradient>
      </defs>
      <rect width="744" height="1039" fill={`url(#${gradientId})`} />
      <rect
        x="14"
        y="14"
        width="716"
        height="1011"
        rx="18"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="2"
      />
      <text
        x="372"
        y="860"
        textAnchor="middle"
        fill="#fafafa"
        fontFamily="var(--font-sans), sans-serif"
        fontSize="44"
        fontWeight="600"
      >
        {name}
      </text>
      <text
        x="372"
        y="920"
        textAnchor="middle"
        fill="rgba(250,250,250,0.45)"
        fontFamily="var(--font-sans), sans-serif"
        fontSize="24"
        letterSpacing="6"
      >
        VOIDDECK SINGLES
      </text>
    </svg>
  );
}

export default CardFrame;
