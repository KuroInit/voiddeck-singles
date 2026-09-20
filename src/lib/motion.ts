import { animate, stagger } from "motion";

/**
 * Vanilla-JS motion helpers (motion.dev core API).
 * Rules: durations <= 250ms; no scroll-linked or layout animation;
 * animations decorate — never gate content (initial hidden state is applied
 * inside these helpers at runtime, never via opacity-0 CSS); every helper
 * early-returns when prefers-reduced-motion is set.
 */
export function reducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Animate direct [data-anim="item"] children: opacity 0->1, y 8->0, staggered. */
export function revealStagger(root: HTMLElement) {
  if (reducedMotion()) return;
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-anim="item"]'));
  if (items.length === 0) return;
  animate(
    items,
    { opacity: [0, 1], transform: ["translateY(8px)", "translateY(0px)"] },
    { duration: 0.18, ease: "easeOut", delay: stagger(0.03) }
  );
}

/** Tab content swap: opacity 0->1, y 6->0, 200ms ease-out. */
export function tabSwap(el: HTMLElement) {
  if (reducedMotion()) return;
  animate(
    el,
    { opacity: [0, 1], transform: ["translateY(6px)", "translateY(0px)"] },
    { duration: 0.2, ease: "easeOut" }
  );
}

/** Cart badge / match badge bump: scale 1->1.15->1. */
export function bump(el: HTMLElement) {
  if (reducedMotion()) return;
  animate(el, { scale: [1, 1.15, 1] }, { duration: 0.18, ease: "easeOut" });
}

/** Listing cards / primary buttons: press feedback scale 0.98. */
export function pressable(el: HTMLElement) {
  if (reducedMotion()) return;
  if (el.dataset.pressable) return;
  el.dataset.pressable = "true";
  const down = () => animate(el, { scale: 0.98 }, { duration: 0.1, ease: "easeOut" });
  const up = () => animate(el, { scale: 1 }, { duration: 0.12, ease: "easeOut" });
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointerleave", up);
  el.addEventListener("pointercancel", up);
}
