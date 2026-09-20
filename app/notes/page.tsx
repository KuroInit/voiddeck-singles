import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CARDS } from "@/data/cards";
import { SEED_LISTINGS } from "@/data/listings";
import { priceMeta, USD_SGD } from "@/lib/prices";

export const metadata: Metadata = {
  title: "Notes — Voiddeck Singles",
  description:
    "What this demo is, what is simulated, where the data comes from, and what was deliberately left out.",
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

export default function NotesPage() {
  const meta = priceMeta();
  const saleCount = SEED_LISTINGS.filter((l) => l.mode === "sale").length;
  const wtbCount = SEED_LISTINGS.filter((l) => l.mode === "wtb").length;
  const sets = Array.from(new Set(CARDS.map((c) => c.cardSet))).sort();
  const sourceLabel =
    meta.source === "bilgewater-market" ? "Bilgewater Market" : "TCGplayer mirror";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6">
      <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Voiddeck Singles — an AI-enabled second-hand marketplace for Riftbound TCG singles,
        built for Singapore buyers and sellers as a demo. Name explained in one line: a
        &ldquo;void deck&rdquo; is the sheltered ground floor common to HDB blocks, and a
        &ldquo;single&rdquo; is one card — so: the void-deck card market.
      </p>

      <Section title="What this is, and who it is for">
        <p>
          Local Singapore Riftbound players and collectors: people chasing rare Showcase
          and Signature printings, and players buying several singles at once to finish a
          deck. Three flows cover that — <strong>Buy</strong>, <strong>Sell</strong>, and{" "}
          <strong>Looking for</strong> (a want-to-buy board that auto-matches active
          listings).
        </p>
      </Section>

      <Section title="What is seeded and what is simulated">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            All sellers, handles, stock counts, pickup notes and asking prices are{" "}
            <strong>fictional demo data</strong>. {saleCount} seeded sale listings and{" "}
            {wtbCount} seeded want-to-buy posts ship with the app.
          </li>
          <li>
            <strong>Checkout is simulated</strong> and labelled as such — no payment is
            processed, no order leaves your browser.
          </li>
          <li>
            Listings and wants you create are stored <strong>only in your browser</strong>{" "}
            (<code>localStorage</code>: <code>vds_user_listings</code>,{" "}
            <code>vds_user_wtb</code>, <code>vds_cart</code>) and are labelled
            &ldquo;demo — stored in your browser&rdquo;. There is no auth and no server
            database, so reviewers always see the seeded marketplace.
          </li>
          <li>
            Seeded singles are an <strong>Origins (OGN) subset</strong>. Card{" "}
            <em>names and set facts are real</em> — verified against public Riftbound set
            lists.
          </li>
        </ul>
      </Section>

      <Section title="Data sources and licences">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Card database</strong> — {CARDS.length.toLocaleString()} printings from
            the <code>riftbound-cards</code> fan dataset (code MIT; card data © Riot
            Games), covering {sets.join(", ")}. It powers the Sell / Looking-for pickers
            and deck import, so every listing maps to a valid card.
          </li>
          <li>
            <strong>Card art</strong> is hot-linked from Riot&apos;s CDN, never committed
            to the project, and shown under Riot&apos;s fan-content policy. When art is
            missing, a locally generated <code>CardFrame</code> SVG placeholder
            renders instead.
          </li>
          <li>
            <strong>Reference prices</strong> come from a dated snapshot:{" "}
            {sourceLabel}
            {meta.asOf ? `, ${meta.asOf}` : ""}. The app never scrapes prices at runtime —
            Bilgewater Market&apos;s API sits behind Firebase App Check and reCAPTCHA, so
            the snapshot is produced offline by a local Playwright script and committed
            with its <code>asOf</code> date. USD → SGD uses a fixed demo rate of{" "}
            {USD_SGD} displayed with &ldquo;≈&rdquo;.
          </li>
          <li>
            Prices shown on listings are <strong>sellers&apos; asking prices</strong>, not
            market values — the shop assistant is instructed to say exactly that.
          </li>
        </ul>
      </Section>

      <Section title="AI: what is real and which model">
        <p>
          Natural-language search, the shop Q&A, and the deck-core builder all call a real
          OpenAI-compatible chat endpoint from the server, keyed from server-only
          environment variables (<code>AI_BASE_URL</code>, <code>AI_API_KEY</code>,{" "}
          <code>AI_MODEL</code>). The model id is whatever <code>AI_MODEL</code> is set to
          in the local <code>.env</code> — it is not hardcoded.
        </p>
        <p>
          Search is one model call that parses intent into facets + keywords; the ranking
          itself is deterministic and local, so results stay inspectable and reproducible.
          The Q&A assistant is grounded on retrieved listings only and is told to name what
          the listings do not establish. The builder&apos;s numbers are never trusted: every
          line is repriced and re-clamped server-side against the real listing data.
        </p>
        <p>
          If the gateway is not configured, every AI surface renders an honest
          &ldquo;AI unavailable&rdquo; state instead of a plausible-sounding fake answer.
        </p>
      </Section>

      <Section title="What was deliberately not built">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Real payments</strong> — a demo cannot be trusted with card details,
            and the brief&apos;s core flow must not require login.
          </li>
          <li>
            <strong>Auth / accounts</strong> — per the brief, no login wall; user content is
            browser-local instead.
          </li>
          <li>
            <strong>Live price refresh</strong> — the only public price source is
            bot-walled; shipping a dated, labelled snapshot is honest, a scraper is not.
          </li>
          <li>
            <strong>Embeddings</strong> — gateway embedding support was unknown at build
            time; intent-parsing plus deterministic scoring needs no extra dependency.
          </li>
          <li>
            <strong>Hosting / CI</strong> — this build is intentionally local-only.
          </li>
        </ul>
      </Section>

      <Section title="Known issues">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Some seeded listings deliberately omit a language or leave other fields unset —
            that is the honesty demo for the Q&A assistant, not a data bug.
          </li>
          <li>
            Deck import depends on <code>riftdecks.com</code> page markup staying as it is;
            a pasted-decklist fallback covers markup drift.
          </li>
          <li>
            Want-to-buy matching is by card and budget only; it does not model condition
            upgrades or quantity bundling across sellers.
          </li>
          <li>
            Reference prices are a snapshot: they can lag the market, and they are shown as
            reference only.
          </li>
          <li>
            A few showcase-promo printings (the overnumbered &ldquo;star&rdquo; codes) have
            no reference price in the snapshot; the honest fallback — &ldquo;no reference
            price available&rdquo; — is shown instead of a guessed figure.{" "}
            <code>jankrats.com</code> was evaluated as an extra source and skipped: it is a
            login-walled collection tracker whose prices are just outbound links to
            Bilgewater Market, i.e. the same data we already snapshot directly.
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