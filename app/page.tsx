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
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <header className="mb-5 sm:mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Riftbound singles, <span className="text-primary">Singapore</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground sm:text-base">
          Buy, sell, and look for Runeterra cards. Chatty search and a grounded shop
          assistant included.
        </p>
      </header>

      <Tabs value={tab} onValueChange={handleTabChange} className="gap-3">
        <TabsList className="h-11 w-full sm:h-12">
          <TabsTrigger value="buy" className="flex-1 text-sm sm:text-[15px]">
            Buy
          </TabsTrigger>
          <TabsTrigger value="sell" className="flex-1 text-sm sm:text-[15px]">
            Sell
          </TabsTrigger>
          <TabsTrigger value="looking" className="flex-1 text-sm sm:text-[15px]">
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