import { useId } from "react";
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

const CHART = {
  size: 200,
  cx: 100,
  cy: 100,
  outer: 94,
  inner: 58,
} as const;

function chartLabel(counts: Record<ApplicationStatus, number>, total: number): string {
  const noun = total === 1 ? "application" : "applications";
  const parts = STATUSES.map((status) => `${counts[status]} ${status}`);
  return `${total} ${noun}: ${parts.join(", ")}.`;
}

function point(radius: number, angle: number): [number, number] {
  return [CHART.cx + radius * Math.cos(angle), CHART.cy + radius * Math.sin(angle)];
}

function annulusPath(start: number, end: number): string {
  const sweep = end - start;
  const large = sweep > Math.PI ? 1 : 0;
  const [x1, y1] = point(CHART.outer, start);
  const [x2, y2] = point(CHART.outer, end);
  const [x3, y3] = point(CHART.inner, end);
  const [x4, y4] = point(CHART.inner, start);
  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${CHART.outer} ${CHART.outer} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${CHART.inner} ${CHART.inner} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    "Z",
  ].join(" ");
}

type Arc = { status: ApplicationStatus; start: number; end: number };

function statusArcs(counts: Record<ApplicationStatus, number>, total: number): Arc[] {
  const present = STATUSES.filter((status) => counts[status] > 0);
  if (total === 0 || present.length === 0) return [];
  const origin = -Math.PI / 2;
  let cursor = 0;
  return present.map((status, index) => {
    const start = origin + cursor * Math.PI * 2;
    cursor += counts[status] / total;
    const end = index === present.length - 1 ? origin + Math.PI * 2 : origin + cursor * Math.PI * 2;
    return { status, start, end };
  });
}

function StatusDonut({
  counts,
  total,
}: {
  counts: Record<ApplicationStatus, number>;
  total: number;
}) {
  const titleId = useId();
  const arcs = statusArcs(counts, total);
  const label = chartLabel(counts, total);
  const ring = (CHART.outer + CHART.inner) / 2;

  return (
    <svg
      viewBox={`0 0 ${CHART.size} ${CHART.size}`}
      className="h-full w-full"
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>{label}</title>
      {arcs.length === 0 ? (
        <circle
          cx={CHART.cx}
          cy={CHART.cy}
          r={ring}
          fill="none"
          stroke="#d0d0d0"
          strokeWidth={CHART.outer - CHART.inner}
        />
      ) : arcs.length === 1 ? (
        <>
          <circle cx={CHART.cx} cy={CHART.cy} r={CHART.outer} fill={STATUS_META[arcs[0].status].bar} />
          <circle cx={CHART.cx} cy={CHART.cy} r={CHART.inner} fill="#ffffff" />
        </>
      ) : (
        arcs.map((arc) => (
          <path key={arc.status} d={annulusPath(arc.start, arc.end)} fill={STATUS_META[arc.status].bar} />
        ))
      )}
      {arcs.length > 1
        ? arcs.map((arc) => {
            const [x1, y1] = point(CHART.inner - 0.75, arc.end);
            const [x2, y2] = point(CHART.outer + 0.75, arc.end);
            return (
              <line
                key={`${arc.status}-edge`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#000000"
                strokeWidth="2.4"
              />
            );
          })
        : null}
    </svg>
  );
}

export function Summary({ applications, now }: SummaryProps) {
  const counts = countByStatus(applications);
  const total = applications.length;
  const upcoming = nextUpcoming(applications, now);
  const scheduled = upcomingCount(applications, now);

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]" aria-label="Summary">
      <div className="flex h-full flex-col rounded-[22px] border-[3px] border-black bg-white p-4 sm:p-6">
        <div className="flex flex-1 items-center justify-center py-1">
          <div className="@container relative mx-auto aspect-square w-full max-w-[230px] sm:max-w-[268px]">
            <StatusDonut counts={counts} total={total} />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <div className="w-[50%] text-center">
                <p className="num text-[clamp(1.9rem,26cqi,3.05rem)] font-semibold leading-none tracking-[-0.05em] text-ink">
                  {total}
                </p>
                <p className="mt-1 text-[clamp(0.68rem,5.6cqi,0.875rem)] font-medium leading-tight text-muted">
                  {total === 1 ? "application" : "applications"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-x-1 border-t border-black/15 pt-4 sm:mt-5 sm:gap-x-5 sm:pt-5">
          {STATUSES.map((status) => {
            const meta = STATUS_META[status];
            return (
              <div key={status} className="min-w-0 text-center">
                <p className="num text-[1.35rem] font-semibold leading-none tracking-[-0.045em] text-ink min-[380px]:text-[1.7rem] sm:text-[2.05rem]">
                  {counts[status]}
                </p>
                <div className="mt-2 flex items-center justify-center gap-1 sm:mt-2.5 sm:gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.bar }} />
                  <p className="text-[11px] font-medium leading-none tracking-[-0.03em] text-ink min-[380px]:text-[12px] sm:text-[13px] sm:leading-4 sm:tracking-normal">
                    {status}
                  </p>
                </div>
                <p className="mt-1 text-balance text-[10px] leading-snug text-muted min-[380px]:text-[11px] sm:text-xs">
                  {meta.caption}
                </p>
              </div>
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
