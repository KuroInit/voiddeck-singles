"use client";

import { useCallback, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BuyTab } from "@/components/buy-tab";
import { SellPanel } from "@/components/sell-panel";
import { WtbBoard } from "@/components/wtb-board";
import { tabSwap } from "@/lib/motion";

export default function Home() {
  const [tab, setTab] = useState("buy");
  const panelRef = useRef<HTMLDivElement>(null);

  const handleTabChange = useCallback((value: string) => {
    setTab(value);
    requestAnimationFrame(() => {
      if (panelRef.current) tabSwap(panelRef.current);
    });
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-5">
      <header className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">
          Riftbound singles, <span className="text-primary">Singapore</span>
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Buy, sell, and look for Runeterra cards. Chatty search and a grounded shop
          assistant included.
        </p>
      </header>

      <Tabs value={tab} onValueChange={handleTabChange} className="gap-3">
        <TabsList className="w-full">
          <TabsTrigger value="buy" className="flex-1">
            Buy
          </TabsTrigger>
          <TabsTrigger value="sell" className="flex-1">
            Sell
          </TabsTrigger>
          <TabsTrigger value="looking" className="flex-1">
            Looking for
          </TabsTrigger>
        </TabsList>

        <div ref={panelRef}>
          <TabsContent value="buy">
            <BuyTab />
          </TabsContent>
          <TabsContent value="sell">
            <SellPanel />
          </TabsContent>
          <TabsContent value="looking">
            <WtbBoard />
          </TabsContent>
        </div>
      </Tabs>

      <p className="mt-6 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="outline" className="border-zinc-700 text-zinc-400">
          demo data
        </Badge>
        <span>
          Sellers, stock and asking prices are fictional. Your own listings and wants
          stay in your browser.
        </span>
      </p>
    </div>
  );
}