import type { Application } from "../types.ts";
import { interviewDate } from "./board.ts";

/**
 * Interviews completed before the AWS layoff that have no interview records
 * on the board (Together AI and Akeyless Security). Always added to the total.
 */
export const PRE_LAYOFF_INTERVIEWS = 2;

/** Start of the AWS layoff day in America/Denver, as an interview timestamp. */
export const LAYOFF_AT = "2026-09-17T00:00";

/**
 * Completed interviews since the layoff, plus {@link PRE_LAYOFF_INTERVIEWS}.
 *
 * An interview counts when its `at` instant (America/Denver, same parsing as
 * the rest of the board) is at or after {@link LAYOFF_AT} and strictly before
 * `now`. That is the same cutoff as `nextInterview`: `at >= now` is still
 * upcoming. Each record counts once.
 */
export function countCompletedInterviews(applications: readonly Application[], now: Date): number {
  const cutoff = interviewDate(LAYOFF_AT).getTime();
  const nowTime = now.getTime();
  let recorded = 0;
  for (const application of applications) {
    for (const interview of application.interviews) {
      const time = interviewDate(interview.at).getTime();
      if (Number.isNaN(time) || Number.isNaN(cutoff) || Number.isNaN(nowTime)) continue;
      if (time >= cutoff && time < nowTime) recorded += 1;
    }
  }
  return recorded + PRE_LAYOFF_INTERVIEWS;
}
