import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getStats } from "@/lib/marketplace";
import { CARDS } from "@/data/cards";
import { priceMeta, USD_SGD } from "@/lib/prices";

export const metadata: Metadata = {
  title: "Notes — Voiddeck Singles",
  description:
    "What this demo is, what is simulated, which AI tools and models it uses, what was deliberately left out, and known issues.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-primary">
        {title}
      </h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const stats = await getStats();
  const meta = priceMeta();
  const sets = Array.from(new Set(CARDS.map((c) => c.cardSet))).sort();
  const sourceLabel =
    meta.source === "bilgewater-market" ? "Bilgewater Market" : "TCGplayer mirror";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Voiddeck Singles — an AI-enabled second-hand marketplace for Riftbound TCG
        singles, built as a demo. A &ldquo;void deck&rdquo; is the sheltered ground
        floor common to HDB blocks, and a &ldquo;single&rdquo; is one card — so: the
        void-deck card market.
      </p>

      <Section title="What this web app is">
        <p>
          A mobile-first marketplace demo for <strong>local Singapore Riftbound
          players and collectors</strong>: people chasing rare Showcase / Signature
          printings, and players buying several singles at once to finish a deck.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Buy</strong> — a grid of listings with facet filters and price
            sort; each listing opens a detail page with the card art, a
            &ldquo;Market Cost&rdquo; reference panel, and a simulated cart and
            checkout.
          </li>
          <li>
            <strong>Sell</strong> — pick a card from the full Riftbound card database
            so every listing maps to a valid card, then set condition, qty, pickup and
            asking price.
          </li>
          <li>
            <strong>Looking for</strong> — a want-to-buy board that auto-matches each
            want against active sale listings, or honestly reports &ldquo;No matches
            yet&rdquo;. Both the market and the board have{" "}
            <strong>natural-language search</strong>.
          </li>
          <li>
            <strong>AI surfaces</strong> — a catalogue-grounded shop Q&A that cites
            listing ids and says what the listings do <em>not</em> establish, a
            deck-core builder that composes a cart under a budget, and deck import
            from a riftdecks.com link.
          </li>
        </ul>
        <p>
          The look is &ldquo;Hextech heartland&rdquo;: League-of-Legends gold and navy
          panels over a faint HDB void-deck tile wall.
        </p>
      </Section>

      <Section title="What is seeded, simulated or otherwise limited">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            All sellers, handles, stock counts, pickup notes and asking prices are{" "}
            <strong>fictional demo data</strong> — {stats.saleCount} sale listings and{" "}
            {stats.wantCount} want-to-buy posts are seeded, spanning{" "}
            <strong>all five sets</strong> ({sets.join(", ")}). Card{" "}
            <em>names and set facts are real</em>, verified against public Riftbound
            set lists.
          </li>
          <li>
            <strong>Checkout is simulated</strong> and labelled as such — no payment is
            processed, no order leaves your browser.
          </li>
          <li>
            Listings, wants and posts you create go into the{" "}
            <strong>local database file</strong> (<code>data/vds.db</code>, embedded
            SQLite via Node&apos;s built-in <code>node:sqlite</code>) alongside the
            seeded marketplace; the cart stays in your browser (
            <code>localStorage: vds_cart</code>). Signing in creates a handle-only
            local demo account — no passwords, {stats.userCount} demo account
            {stats.userCount === 1 ? "" : "s"} so far.
          </li>
          <li>
            <strong>Reference prices are a dated snapshot</strong>, not live data:{" "}
            {sourceLabel}
            {meta.asOf ? `, ${meta.asOf}` : ""} — {stats.variationCount.toLocaleString()}{" "}
            per-variation rows ({stats.foilCount.toLocaleString()} foil). The source
            does not offer public programmatic access, so the snapshot is produced
            offline and committed with its <code>asOf</code> date; the app never
            fetches prices at runtime. Because there is a single dated point rather
            than a price history, listing pages show <strong>Market Cost</strong> as of
            the snapshot instead of a chart. USD → SGD uses a fixed demo rate of{" "}
            {USD_SGD}, displayed with &ldquo;≈&rdquo;.
          </li>
          <li>
            Card data comes from the <code>riftbound-cards</code> fan dataset (code
            MIT; card data © Riot Games); art is hot-linked from Riot&apos;s CDN under
            Riot&apos;s fan-content policy, with a locally generated SVG placeholder
            when art is missing.
          </li>
        </ul>
      </Section>

      <Section title="AI coding tools, and which models power search and Q&A">
        <p>
          <strong>Build tooling:</strong> the project was implemented with AI coding
          agents (Claude, driven through an agentic coding harness) under human
          direction — product and design calls were made by a human, and every
          submitted change was human-reviewed.
        </p>
        <p>
          <strong>Runtime models:</strong> one chat model serves all AI surfaces —{" "}
          <code>openai/gpt-4o-mini</code> via the OpenAI-compatible gateway, keyed
          from server-only environment variables (<code>AI_BASE_URL</code>,{" "}
          <code>AI_API_KEY</code>, <code>AI_MODEL</code>); nothing is hardcoded and no
          key ever reaches the browser. The gateway may substitute another model when
          the weekly allowance runs out — the app only assumes an OpenAI-compatible{" "}
          <code>/chat/completions</code>, so it keeps working either way.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Search</strong> — the query is parsed by the model server-side
            (<code>POST /api/search</code>) into structured intent (keywords, set /
            printing / rarity / language / condition / type facets, price bounds, sort
            order), sanitised against the real catalogue vocabulary, then scored
            deterministically against the catalogue. The parsed intent is shown as
            chips. If the gateway is off or unusable, the same query falls back to a
            local deterministic parser — search always works, and the UI says which
            parser ran.
          </li>
          <li>
            <strong>Shop Q&amp;A</strong> — grounded on retrieved listings only, cites
            listing ids like [L07], and is instructed to name what the listings do not
            establish instead of guessing.
          </li>
          <li>
            <strong>Deck-core builder</strong> — proposes a cart from available
            singles; every line is repriced and re-clamped server-side against the real
            listing data, so model-authored numbers are never trusted.
          </li>
        </ul>
      </Section>

      <Section title="What we chose not to build, and why">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Real payments</strong> — a demo cannot be trusted with card
            details, and the brief&apos;s core flow must not require login.
          </li>
          <li>
            <strong>Auth / accounts</strong> — no login wall and no passwords;
            sign-in is a one-click local demo handle, and posts are attributed to it
            without any access control.
          </li>
          <li>
            <strong>Live price refresh</strong> — the only public price source does not
            offer programmatic access; shipping a dated, labelled snapshot is honest,
            a scraper is not.
          </li>
          <li>
            <strong>Embeddings</strong> — model intent-parsing plus deterministic
            scoring needs no extra dependency and works with the gateway off.
          </li>
          <li>
            <strong>Hosting / CI</strong> — the build is intentionally local-only for
            now; public deployment is planned but not done.
          </li>
        </ul>
      </Section>

      <Section title="Known issues and unfinished parts">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Some seeded listings deliberately omit a language or leave other fields
            unset — that is the honesty demo for the Q&amp;A assistant, not a data bug.
          </li>
          <li>
            Deck import depends on <code>riftdecks.com</code> page markup staying as it
            is; a pasted-decklist fallback covers markup drift.
          </li>
          <li>
            Want-to-buy matching is by card and budget only; it does not model
            condition upgrades or quantity bundling across sellers.
          </li>
          <li>
            Reference prices are a snapshot: they can lag the market, and there is no
            price history to chart — overnumbered showcase promos with no snapshot
            entry show &ldquo;no reference price available&rdquo; instead of a guessed
            figure.
          </li>
          <li>
            The demo is deployed on Vercel, where the SQLite file lives per-instance in{" "}
            <code>/tmp</code>: seeded data always appears, but posts and wants you
            create reset on cold start or redeploy. There is no API rate limiting —
            an in-memory limiter never fires reliably on serverless, so input lengths
            are capped at every boundary instead and the AI budget is bounded by the
            gateway allowance.
          </li>
        </ul>
      </Section>

      <Separator className="mt-8" />
      <p className="mt-4 text-xs text-muted-foreground">
        Unofficial fan demo — not affiliated with Riot Games. All listings are fictional.{" "}
        <Link href="/" className="text-primary underline-offset-2 hover:underline">
          Back to the market
        </Link>
      </p>
      <p className="mt-2 flex flex-wrap gap-2 text-[11px]">
        <Badge variant="outline" className="border-zinc-700 text-zinc-400">
          demo data
        </Badge>
        <Badge variant="outline" className="border-zinc-700 text-zinc-400">
          local-only
        </Badge>
        <Badge variant="outline" className="border-amber-700 text-amber-400">
          AI-grounded, no fake answers
        </Badge>
      </p>
    </div>
  );
}
