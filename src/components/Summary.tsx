import { useEffect, useId, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from "react";
import {
  countByStatus,
  formatConcrete,
  nextUpcoming,
  relativeDayLabel,
  upcomingCount,
} from "../lib/board.ts";
import { STATUS_META } from "../lib/status.ts";
import { STATUSES, type Application, type ApplicationStatus } from "../types.ts";
import { CalendarIcon } from "./Icons.tsx";
import { RoleTitle } from "./RoleTitle.tsx";

type SummaryProps = {
  applications: Application[];
  now: Date;
};

/**
 * Reference geometry from the stepped ring chart: a 400 viewBox, every segment
 * a circle r=50 at (200,200), stroke width 16*n-10*i, the group turned -90°
 * so the sweep starts at 12 o'clock, and a center disc r=50. A uniform scale
 * keeps those attributes and fills the card.
 */
const VB = 400;
const CX = 200;
const CY = 200;
const RADIUS = 50;
const CIRC = 2 * Math.PI * RADIUS;
const CHART_SCALE = 2.15;
const HOVER_GROWTH = 12;
const RING_OUTLINE = 3.5;

type Segment = {
  status: ApplicationStatus;
  count: number;
  index: number;
  fraction: number;
  cumulative: number;
  soft: string;
  width: number;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** GSAP power3.out: fast start, gentle settle. */
function power3Out(t: number): number {
  return 1 - (1 - t) ** 3;
}

function useDrawProgress(count: number, reduced: boolean): number[] {
  const [progress, setProgress] = useState<number[]>(() => Array(count).fill(0));

  useEffect(() => {
    if (count === 0 || reduced) return;
    const durations = Array.from({ length: count }, (_, index) => 900 + index * 280);
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - started;
      setProgress(durations.map((duration) => power3Out(Math.min(1, elapsed / duration))));
      if (elapsed < durations[durations.length - 1]) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [count, reduced]);

  if (count === 0) return [];
  if (reduced) return Array(count).fill(1);
  return progress;
}

function buildSegments(counts: Record<ApplicationStatus, number>, total: number): Segment[] {
  const present = STATUSES.filter((status) => counts[status] > 0);
  const n = present.length;
  let cursor = 0;
  return present.map((status, index) => {
    const fraction = total === 0 ? 0 : counts[status] / total;
    cursor += fraction;
    return {
      status,
      count: counts[status],
      index,
      fraction,
      cumulative: index === n - 1 ? 1 : cursor,
      soft: STATUS_META[status].soft,
      width: 16 * n - 10 * index,
    };
  });
}

function integerPercents(counts: Record<ApplicationStatus, number>, total: number): Record<ApplicationStatus, number> {
  const result = { Applied: 0, Interviewing: 0, "Not hired": 0 } as Record<ApplicationStatus, number>;
  if (total <= 0) return result;
  const raw = STATUSES.map((status) => (counts[status] / total) * 100);
  const floors = raw.map((value) => Math.floor(value));
  let left = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - floors[index] }))
    .sort((a, b) => b.frac - a.frac);
  for (const item of order) {
    if (left <= 0) break;
    if (raw[item.index] === 0) continue;
    floors[item.index] += 1;
    left -= 1;
  }
  STATUSES.forEach((status, index) => {
    result[status] = floors[index];
  });
  return result;
}

function shadePoints(angle: number, outer: number): string {
  const inner = 46;
  const back = angle - 0.2;
  const mid = angle - 0.08;
  const at = (radius: number, theta: number) => {
    const x = CX + radius * Math.cos(theta);
    const y = CY + radius * Math.sin(theta);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  };
  return [at(inner, angle), at(outer + 2, angle), at(outer - 1, mid), at(inner + 2, back)].join(" ");
}

function wedgePath(startFrac: number, endFrac: number): string {
  const start = startFrac * Math.PI * 2;
  const end = endFrac * Math.PI * 2;
  const inner = 28;
  const outer = 92;
  const large = end - start > Math.PI ? 1 : 0;
  const at = (radius: number, angle: number) => {
    const x = CX + radius * Math.cos(angle);
    const y = CY + radius * Math.sin(angle);
    return `${x.toFixed(2)} ${y.toFixed(2)}`;
  };
  return [
    `M ${at(outer, start)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${at(outer, end)}`,
    `L ${at(inner, end)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${at(inner, start)}`,
    "Z",
  ].join(" ");
}

function readStatus(target: EventTarget | null): ApplicationStatus | null {
  if (!(target instanceof Element)) return null;
  const value = target.closest("[data-status]")?.getAttribute("data-status");
  if (value === "Applied" || value === "Interviewing" || value === "Not hired") return value;
  return null;
}

function SegmentHit({
  segment,
  label,
  pressed,
  onHover,
  onToggle,
  onKey,
}: {
  segment: Segment;
  label: string;
  pressed: boolean;
  onHover: (status: ApplicationStatus | null) => void;
  onToggle: (status: ApplicationStatus) => void;
  onKey: (event: KeyboardEvent, status: ApplicationStatus) => void;
}) {
  const start = segment.cumulative - segment.fraction;
  const handlers = {
    "data-status": segment.status,
    tabIndex: 0,
    role: "button" as const,
    "aria-label": label,
    "aria-pressed": pressed,
    fill: "transparent",
    pointerEvents: "fill" as const,
    className: "cursor-pointer outline-offset-2",
    onPointerEnter: (event: PointerEvent<SVGElement>) => {
      if (event.pointerType === "mouse") onHover(segment.status);
    },
    onFocus: () => onHover(segment.status),
    onBlur: (event: FocusEvent<SVGElement>) => {
      if (readStatus(event.relatedTarget)) return;
      onHover(null);
    },
    onClick: (event: MouseEvent<SVGElement>) => {
      event.stopPropagation();
      onToggle(segment.status);
    },
    onKeyDown: (event: KeyboardEvent<SVGElement>) => onKey(event, segment.status),
  };
  if (segment.fraction > 0.999) {
    return <circle cx={CX} cy={CY} r={90} {...handlers} />;
  }
  return <path d={wedgePath(start, segment.cumulative)} {...handlers} />;
}

function chartLabel(counts: Record<ApplicationStatus, number>, total: number): string {
  const noun = total === 1 ? "application" : "applications";
  const parts = STATUSES.map((status) => `${counts[status]} ${status}`);
  return `${total} ${noun}: ${parts.join(", ")}.`;
}

function StatusDonut({
  segments,
  progress,
  total,
  counts,
  active,
  onHover,
  onToggle,
  onDismiss,
  label,
}: {
  segments: Segment[];
  progress: number[];
  total: number;
  counts: Record<ApplicationStatus, number>;
  active: ApplicationStatus | null;
  onHover: (status: ApplicationStatus | null) => void;
  onToggle: (status: ApplicationStatus) => void;
  onDismiss: () => void;
  label: string;
}) {
  const titleId = useId();
  const percents = integerPercents(counts, total);

  const onKey = (event: KeyboardEvent, status: ApplicationStatus) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle(status);
    }
  };

  return (
    <svg
      viewBox={`0 0 ${VB} ${VB}`}
      className="h-full w-full overflow-visible"
      role="group"
      aria-labelledby={titleId}
      onPointerLeave={(event) => {
        if (event.pointerType !== "mouse") return;
        if (readStatus(event.relatedTarget)) return;
        onHover(null);
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <title id={titleId}>{label}</title>
      <g transform={`translate(${CX} ${CY}) scale(${CHART_SCALE}) translate(${-CX} ${-CY})`}>
        <g transform={`rotate(-90 ${CX} ${CY})`}>
          {segments.length === 0 ? (
            <circle cx={CX} cy={CY} r={RADIUS} fill="none" stroke="#d0d0d0" strokeWidth={18} />
          ) : (
            [...segments].reverse().map((segment) => {
              const revealed = segment.cumulative * (progress[segment.index] ?? 0);
              const length = revealed * CIRC;
              const hovered = active === segment.status;
              const width = hovered ? segment.width + HOVER_GROWTH : segment.width;
              const ring = {
                cx: CX,
                cy: CY,
                r: RADIUS,
                fill: "none" as const,
                strokeLinecap: "butt" as const,
                pointerEvents: "none" as const,
                strokeDasharray: `${length} ${CIRC}`,
              };
              const widthTransition = { transition: "stroke-width 280ms cubic-bezier(0.22, 1, 0.36, 1)" };
              return (
                <g key={segment.status}>
                  <circle
                    {...ring}
                    stroke="#111111"
                    style={{ ...widthTransition, strokeWidth: width + RING_OUTLINE }}
                  />
                  <circle {...ring} stroke={segment.soft} style={{ ...widthTransition, strokeWidth: width }} />
                </g>
              );
            })
          )}
          {segments.map((segment) => {
            const revealed = segment.cumulative * (progress[segment.index] ?? 0);
            if (segment.fraction > 0.985 || revealed < 0.03) return null;
            const outer = RADIUS + segment.width / 2;
            return (
              <polygon
                key={`${segment.status}-shade`}
                points={shadePoints(revealed * Math.PI * 2, outer)}
                fill="rgba(0,0,0,0.2)"
                pointerEvents="none"
                opacity={Math.min(1, (progress[segment.index] ?? 0) * 1.3)}
              />
            );
          })}
        </g>
        <circle cx={CX} cy={CY} r={RADIUS} fill="#10101a" stroke="#000000" strokeWidth={8} pointerEvents="none" />
        <g transform={`rotate(-90 ${CX} ${CY})`}>
          {segments.map((segment) => (
            <SegmentHit
              key={`${segment.status}-hit`}
              segment={segment}
              label={`${segment.status}, ${segment.count} of ${total}, ${percents[segment.status]} percent`}
              pressed={active === segment.status}
              onHover={onHover}
              onToggle={onToggle}
              onKey={onKey}
            />
          ))}
        </g>
      </g>
    </svg>
  );
}

function DrawnDonut({
  reduced,
  ...props
}: Omit<Parameters<typeof StatusDonut>[0], "progress"> & { reduced: boolean }) {
  const progress = useDrawProgress(props.segments.length, reduced);
  return <StatusDonut {...props} progress={progress} />;
}

export function Summary({ applications, now }: SummaryProps) {
  const counts = countByStatus(applications);
  const total = applications.length;
  const upcoming = nextUpcoming(applications, now);
  const scheduled = upcomingCount(applications, now);
  const segments = buildSegments(counts, total);
  const signature = segments.map((segment) => `${segment.status}:${segment.count}`).join("|");
  const reduced = usePrefersReducedMotion();
  const percents = integerPercents(counts, total);
  const [hovered, setHovered] = useState<ApplicationStatus | null>(null);
  const [pinned, setPinned] = useState<ApplicationStatus | null>(null);
  const [shown, setShown] = useState<ApplicationStatus | null>(null);
  const active = hovered ?? pinned;
  const label = chartLabel(counts, total);

  const hover = (status: ApplicationStatus | null) => {
    setHovered(status);
    if (status) setShown(status);
  };

  const toggle = (status: ApplicationStatus) => {
    setShown(status);
    setPinned((current) => (current === status ? null : status));
  };

  const clear = () => {
    setHovered(null);
    setPinned(null);
  };

  return (
    <section
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"
      aria-label="Summary"
      onKeyDown={(event) => {
        if (event.key === "Escape") clear();
      }}
    >
      <div className="flex h-full flex-col rounded-[22px] border-[3px] border-black bg-white p-4 sm:p-6">
        <div className="flex flex-1 items-center justify-center py-1">
          <div className="@container relative mx-auto aspect-square w-full max-w-[300px] sm:max-w-[340px]">
            <DrawnDonut
              key={signature || "empty"}
              segments={segments}
              total={total}
              counts={counts}
              reduced={reduced}
              active={active}
              onHover={hover}
              onToggle={toggle}
              onDismiss={clear}
              label={label}
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <div
                className="w-[46%] text-center transition-opacity duration-300"
                style={{ opacity: active ? 0 : 1 }}
              >
                <p
                  className="num font-semibold leading-none tracking-[-0.05em] text-white"
                  style={{ fontSize: "clamp(1.55rem, 12cqi, 2.35rem)", color: "#ffffff" }}
                >
                  {total}
                </p>
                <p
                  className="mt-1 font-medium leading-tight"
                  style={{ fontSize: "clamp(0.62rem, 3.6cqi, 0.8rem)", color: "rgba(255,255,255,0.78)" }}
                >
                  {total === 1 ? "application" : "applications"}
                </p>
              </div>
              <div
                className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
                style={{ opacity: active ? 1 : 0 }}
              >
                {shown ? (
                  <div className="w-[46%] text-center">
                    <p
                      className="num font-bold leading-none tracking-[-0.05em]"
                      style={{ fontSize: "clamp(1.45rem, 11cqi, 2.15rem)", color: STATUS_META[shown].onDark }}
                    >
                      {percents[shown]}%
                    </p>
                    <p
                      className="mt-1 font-medium leading-tight"
                      style={{ fontSize: "clamp(0.62rem, 3.4cqi, 0.78rem)", color: "rgba(255,255,255,0.78)" }}
                    >
                      {shown}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-x-1 border-t border-black/15 pt-4 sm:mt-5 sm:gap-x-5 sm:pt-5">
          {STATUSES.map((status) => {
            const meta = STATUS_META[status];
            const dim = active !== null && active !== status;
            return (
              <button
                key={status}
                type="button"
                data-status={status}
                aria-pressed={pinned === status}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse") hover(status);
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType !== "mouse") return;
                  if (readStatus(event.relatedTarget)) return;
                  hover(null);
                }}
                onFocus={() => hover(status)}
                onBlur={(event) => {
                  if (readStatus(event.relatedTarget)) return;
                  hover(null);
                }}
                onClick={() => toggle(status)}
                className="min-w-0 cursor-pointer rounded-lg border-0 bg-transparent p-0 text-center font-inherit transition-opacity duration-300"
                style={{ opacity: dim ? 0.33 : 1 }}
              >
                <span className="num block text-[1.35rem] font-semibold leading-none tracking-[-0.045em] text-ink min-[380px]:text-[1.7rem] sm:text-[2.05rem]">
                  {counts[status]}
                </span>
                <span className="mt-2 flex items-center justify-center gap-1 sm:mt-2.5 sm:gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.text }} />
                  <span className="text-[11px] font-medium leading-none tracking-[-0.03em] text-ink min-[380px]:text-[12px] sm:text-[13px] sm:leading-4 sm:tracking-normal">
                    {status}
                  </span>
                </span>
                <span className="mt-1 block text-balance text-[10px] leading-snug text-muted min-[380px]:text-[11px] sm:text-xs">
                  {meta.caption}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex h-full flex-col rounded-[22px] border-[3px] border-black bg-[#d4f3e4] p-5 text-ink sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Next interview</p>
          <CalendarIcon className="h-4 w-4 text-live" />
        </div>
        {upcoming ? (
          <div className="mt-6 flex flex-1 flex-col">
            <p className="text-[1.85rem] font-semibold leading-none tracking-[-0.04em] text-ink">
              {relativeDayLabel(upcoming.interview.at, now)}
            </p>
            <p className="mt-2 text-sm text-muted">{formatConcrete(upcoming.interview.at)}</p>
            <div className="mt-auto border-t border-black/15 pt-4">
              <p className="font-medium text-ink">{upcoming.application.company}</p>
              <p className="mt-0.5 text-sm text-muted">
                <RoleTitle role={upcoming.application.role} jobUrl={upcoming.application.jobUrl} />
              </p>
              <p className="mt-3 inline-flex rounded-full border-[2px] border-black/20 bg-white/70 px-2.5 py-1 text-xs font-medium text-ink">
                {upcoming.interview.kind}
              </p>
              <p className="mt-3 text-xs text-muted">
                {scheduled > 1 ? `Soonest of ${scheduled} scheduled` : "On the calendar"}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-[1.7rem] font-semibold leading-[1.1] tracking-[-0.04em] text-ink">Nothing on the calendar</p>
            <p className="mt-3 max-w-[16rem] text-sm leading-5 text-muted">
              The next scheduled conversation will show here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
