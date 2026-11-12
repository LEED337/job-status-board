import { useEffect, useRef, useState } from "react";
import { PRE_LAYOFF_INTERVIEWS } from "../lib/interviewCount.ts";

const COUNT_UP_MS = 700;
const SUBTITLE = `Since AWS layoff (Sep 17, 2026), incl. ${PRE_LAYOFF_INTERVIEWS} before`;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

function useCountUp(target: number, reduced: boolean): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : 0));
  const shownRef = useRef(shown);

  useEffect(() => {
    if (reduced) {
      shownRef.current = target;
      return;
    }
    const from = shownRef.current;
    if (from === target) return;
    const started = performance.now();
    let frame = 0;
    let latest = from;
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / COUNT_UP_MS);
      const next = Math.round(from + (target - from) * easeOut(t));
      if (next !== latest) {
        latest = next;
        setShown(next);
      }
      if (t < 1) frame = requestAnimationFrame(step);
      else shownRef.current = target;
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      shownRef.current = latest;
    };
  }, [reduced, target]);

  return reduced ? target : shown;
}

function fullSentence(count: number): string {
  const noun = count === 1 ? "interview" : "interviews";
  return `${count} ${noun} completed since the AWS layoff on September 17, 2026, including ${PRE_LAYOFF_INTERVIEWS} before.`;
}

export function InterviewTicker({ count }: { count: number }) {
  const reduced = usePrefersReducedMotion();
  const shown = useCountUp(count, reduced);

  return (
    <p
      role="status"
      aria-label={fullSentence(count)}
      title={SUBTITLE}
      className="inline-flex max-w-full flex-col items-center rounded-full border-[3px] border-black bg-white px-3.5 py-1.5 text-center text-ink"
    >
      <span aria-hidden="true" className="text-sm font-semibold leading-none tracking-[-0.02em] whitespace-nowrap">
        <span className="num">{shown}</span> interviews completed
      </span>
      <span aria-hidden="true" className="mt-1 max-w-full text-[11px] font-medium leading-snug text-pretty text-muted">
        {SUBTITLE}
      </span>
    </p>
  );
}
