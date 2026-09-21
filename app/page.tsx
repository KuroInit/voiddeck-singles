import { Badge } from "@/components/ui/badge";
import { HomeTabs, type CatalogFacets, type WantPost } from "@/components/home-tabs";
import { CARDS } from "@/data/cards";
import { RARITY_CLASSES } from "@/lib/rarity";
import { getListings, getWtbPosts } from "@/lib/marketplace";
import { getCurrentUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [sale, wants, user] = await Promise.all([
    getListings("sale"),
    getWtbPosts(),
    getCurrentUser(),
  ]);

  // getWtbPosts already resolves each want's best in-budget listing server-side.
  const posts: WantPost[] = wants.map((p) => ({ ...p, match: p.match ?? null }));

  // Facet options for the card picker, computed on the server so the client
  // bundle never needs the full cards catalogue.
  const catalog: CatalogFacets = {
    total: CARDS.length,
    sets: Array.from(new Set(CARDS.map((c) => c.cardSet))).sort(),
    rarities: Object.keys(RARITY_CLASSES),
    domains: Array.from(
      new Set(CARDS.map((c) => c.domain).filter((d) => d.length > 0)),
    ).sort(),
    types: Array.from(new Set(CARDS.map((c) => c.cardType))).sort(),
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <header className="mb-5 sm:mb-6">
        <h1 className="text-2xl font-semibold tracking-[0.04em] text-gold-bright uppercase sm:text-3xl">
          Riftbound singles, <span className="text-gold">Singapore</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
          Buy, sell, and look for Riftbound cards under one HDB block. Natural-language
          search, facet filters, and a grounded shop assistant included.
        </p>
        <div className="rune-divider mt-4 max-w-xs" />
      </header>

      <HomeTabs sale={sale} wants={posts} user={user} catalog={catalog} />

      <p className="mt-6 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="outline" className="border-zinc-700 text-zinc-400">
          demo data
        </Badge>
        <span>
          Sellers, stock and asking prices are fictional. Your own listings and wants
          are stored in your local database.
        </span>
      </p>
    </div>
  );
}
