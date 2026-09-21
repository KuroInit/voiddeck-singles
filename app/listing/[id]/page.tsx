import type { ReactNode } from "react";
import Link from "next/link";
import { DetailArt, ListingActions } from "@/components/listing-detail-client";
import { VariationPriceList } from "@/components/variation-price-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { findCard } from "@/data/cards";
import { getListingById } from "@/lib/marketplace";
import {
  conditionLabel,
  languageLabel,
  pickupLabel,
  printingLabel,
  rarityClass,
  typeLabel,
} from "@/lib/rarity";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[13px] text-zinc-500 sm:text-sm">{label}</span>
      <span className="text-right text-sm text-zinc-200 sm:text-[15px]">{value}</span>
    </div>
  );
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListingById(id);

  if (listing === null) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-3 px-4 py-16">
        <p className="text-lg font-medium text-zinc-200">Listing not found</p>
        <p className="text-sm text-zinc-500">
          It may have been sold, cancelled, or removed.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to the market</Link>
        </Button>
      </div>
    );
  }

  const card = findCard(listing.cardCode);
  const isWtb = listing.mode === "wtb";

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <Link href="/" className="text-[13px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline">
        ← Back to the market
      </Link>

      {/* Mobile: title → card image (+ market cost) → price → actions → details.
          Desktop (lg): image left column spanning both rows, info right. */}
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start lg:gap-x-6 lg:gap-y-3">
        <div className="flex flex-col gap-2 lg:col-start-2 lg:row-start-1">
          <div className="flex flex-wrap items-center gap-2">
            {isWtb ? (
              <Badge variant="outline" className="border-amber-700 text-amber-400">
                Wanted to buy
              </Badge>
            ) : null}
            {listing.source === "user" ? (
              <Badge variant="outline" className="border-amber-700 text-amber-400">
                your listing
              </Badge>
            ) : null}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">{listing.cardName}</h1>
          {card ? (
            <p className="text-[13px] text-zinc-500 sm:text-sm">
              {card.fullName !== card.name ? `${card.fullName} · ` : ""}
              {card.cardSet} · {card.cardNumber}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={rarityClass(listing.rarity)}>
              {printingLabel(listing.printing)}
            </Badge>
            <Badge variant="outline" className={rarityClass(listing.rarity)}>
              {listing.rarity}
            </Badge>
            <Badge variant="outline" className="text-zinc-400">
              {typeLabel(listing.type)}
            </Badge>
            {listing.grade ? (
              <Badge variant="outline" className="border-amber-700 text-amber-400">
                {listing.grade}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="flex w-full max-w-xs shrink-0 flex-col gap-3 self-center lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-auto">
          <DetailArt listing={listing} />
          <VariationPriceList cardCode={listing.cardCode} />
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:col-start-2 lg:row-start-2">
          <p className="text-3xl font-semibold tracking-tight text-amber-400 tabular-nums sm:text-4xl">
            {isWtb ? `S$${listing.budgetSgd?.toFixed(2)}` : `S$${listing.priceSgd.toFixed(2)}`}
            <span className="ml-2 text-[13px] font-normal text-zinc-500 sm:text-sm">
              {isWtb ? "want to buy" : "asking price, not market value"}
            </span>
          </p>

          <ListingActions listing={listing} />

          <Card className="flex flex-col p-4">
            {(
              [
                <Field key="printing" label="Printing" value={printingLabel(listing.printing)} />,
                <Field key="rarity" label="Rarity" value={listing.rarity} />,
                <Field key="type" label="Type" value={typeLabel(listing.type)} />,
                <Field key="condition" label="Condition" value={conditionLabel(listing.condition)} />,
                <Field
                  key="language"
                  label="Language"
                  value={
                    listing.language === null
                      ? "not stated in this listing"
                      : languageLabel(listing.language)
                  }
                />,
                ...(listing.grade
                  ? [<Field key="grade" label="Grade" value={listing.grade} />]
                  : []),
                <Field key="qty" label="Qty" value={`×${listing.qty}`} />,
                <Field key="seller" label="Seller" value={`@${listing.seller}`} />,
                <Field key="pickup" label="Pickup" value={pickupLabel(listing.pickup)} />,
                <Field key="id" label="Listing ID" value={listing.id} />,
                <Field key="mode" label="Mode" value={listing.mode} />,
              ] as ReactNode[]
            ).map((field, i) => (
              <div key={i} className="flex flex-col gap-2.5">
                {i > 0 ? <Separator /> : null}
                {field}
              </div>
            ))}
          </Card>

          {listing.note ? (
            <div className="rounded-lg border border-zinc-800 p-3">
              <p className="text-[10px] tracking-wide text-zinc-500 uppercase">Seller note</p>
              <p className="mt-1 text-sm text-zinc-300">{listing.note}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
