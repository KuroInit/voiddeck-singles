"use client";

import { useCallback, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BuyTab } from "@/components/buy-tab";
import { SellPanel } from "@/components/sell-panel";
import { WtbBoard } from "@/components/wtb-board";
import type { Listing } from "@/data/listings";
import { tabSwap } from "@/lib/motion";

/** Local demo account shape, as returned by GET /api/users/me. */
export type VdsUser = { id: string; handle: string; kind: string };

/** Facet options computed server-side from the cards table (kept out of the client bundle). */
export type CatalogFacets = {
  total: number;
  sets: string[];
  rarities: string[];
  domains: string[];
  types: string[];
};

/** Want post with the server-computed cheapest matching listing. `source` is
 * widened so deck-import proposals ("ai_proposed") can be surfaced honestly. */
export type WantPost = Omit<Listing, "source"> & {
  source: "seed" | "user" | "ai_proposed";
  match: Listing | null;
};

/**
 * Client shell for the Buy / Sell / Looking-for tabs. All data arrives as
 * props from the server page; this component only owns tab state + the
 * tabSwap motion.
 */
export function HomeTabs({
  sale,
  wants,
  user,
  catalog,
}: {
  sale: Listing[];
  wants: WantPost[];
  user: VdsUser | null;
  catalog: CatalogFacets;
}) {
  const [tab, setTab] = useState("buy");
  const panelRef = useRef<HTMLDivElement>(null);

  const handleTabChange = useCallback((value: string) => {
    setTab(value);
    requestAnimationFrame(() => {
      if (panelRef.current) tabSwap(panelRef.current);
    });
  }, []);

  return (
    <Tabs value={tab} onValueChange={handleTabChange} className="gap-3">
      <TabsList
        variant="line"
        className="h-11 w-full justify-stretch gap-0 rounded-none border-b border-gold/25 bg-hex-deep/60 sm:h-12"
      >
        <TabsTrigger
          value="buy"
          className="font-heading flex-1 rounded-none text-[13px] tracking-[0.12em] uppercase after:bg-primary data-active:text-gold-bright sm:text-sm"
        >
          Buy
        </TabsTrigger>
        <TabsTrigger
          value="sell"
          className="font-heading flex-1 rounded-none text-[13px] tracking-[0.12em] uppercase after:bg-primary data-active:text-gold-bright sm:text-sm"
        >
          Sell
        </TabsTrigger>
        <TabsTrigger
          value="looking"
          className="font-heading flex-1 rounded-none text-[13px] tracking-[0.12em] uppercase after:bg-primary data-active:text-gold-bright sm:text-sm"
        >
          Looking for
        </TabsTrigger>
      </TabsList>

      <div ref={panelRef}>
        <TabsContent value="buy">
          <BuyTab listings={sale} />
        </TabsContent>
        <TabsContent value="sell">
          <SellPanel listings={sale} user={user} catalog={catalog} />
        </TabsContent>
        <TabsContent value="looking">
          <WtbBoard posts={wants} catalog={catalog} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
