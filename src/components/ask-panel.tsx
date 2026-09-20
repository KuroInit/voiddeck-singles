"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { revealStagger } from "@/lib/motion";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

type AskPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId?: string;
};

type AskResponse = {
  text: string;
  citations: { id: string; quote: string }[];
  unknowns: string[];
};

const EXAMPLES = [
  "which Jinx listing is graded?",
  "does the Ahri alt art listing say which language?",
  "what's a Fury Rune worth?",
];

export function AskPanel({ open, onOpenChange, listingId }: AskPanelProps) {
  const [q, setQ] = useState("");
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const answerRef = useRef<HTMLDivElement | null>(null);

  // Fresh slate whenever the sheet closes.
  useEffect(() => {
    if (!open) {
      setQ("");
      setAnswer(null);
      setError(null);
      setPending(false);
    }
  }, [open]);

  useEffect(() => {
    if (answer && answerRef.current) revealStagger(answerRef.current);
  }, [answer]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || pending) return;
    setQ(text);
    setPending(true);
    setAnswer(null);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, ...(listingId ? { listingId } : {}) }),
      });
      if (res.status === 503) {
        setError("AI unavailable — server env not set");
        return;
      }
      if (!res.ok) {
        setError("Could not get an answer — try again");
        return;
      }
      const data = (await res.json()) as AskResponse;
      setAnswer(data);
    } catch {
      setError("Could not get an answer — try again");
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-xl"
      >
        <SheetHeader>
          <SheetTitle>Ask the shop</SheetTitle>
          <SheetDescription>
            Questions answered only from what the listings actually say — nothing made
            up. (demo)
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-4">
          <div className="space-y-1.5">
            <Label htmlFor="ask-q" className="sr-only">
              Your question
            </Label>
            <Textarea
              id="ask-q"
              rows={2}
              placeholder="e.g. which Jinx listing is graded?"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(q);
                }
              }}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => void ask(ex)}
                className="rounded-4xl border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-amber-700 hover:text-amber-400"
              >
                {ex}
              </button>
            ))}
          </div>

          <Button
            onClick={() => void ask(q)}
            disabled={pending || q.trim().length === 0}
            className="w-full"
          >
            {pending ? "Thinking…" : "Ask"}
          </Button>

          {pending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : null}

          {error ? <p className="text-sm text-amber-400">{error}</p> : null}

          {answer && !pending ? (
            <div ref={answerRef} className="space-y-3">
              <p className="text-sm whitespace-pre-wrap">{answer.text}</p>

              {answer.citations.length > 0 ? (
                <div data-anim="item" className="space-y-1.5">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    Sources
                  </h4>
                  <ul className="space-y-1">
                    {answer.citations.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/listing/${c.id}`}
                          className="block rounded-lg border border-border px-2.5 py-1.5 text-xs transition-colors hover:border-amber-700"
                        >
                          <span className="font-mono text-amber-400">{c.id}</span>
                          <span className="text-muted-foreground"> — “{c.quote}”</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {answer.unknowns.length > 0 ? (
                <div data-anim="item" className="space-y-1">
                  <h4 className="text-xs font-medium text-muted-foreground">
                    Not established by these listings
                  </h4>
                  <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                    {answer.unknowns.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
