import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Application, BoardFile } from "../types.ts";
import { interviewDate } from "./board.ts";
import { LAYOFF_AT, PRE_LAYOFF_INTERVIEWS, countCompletedInterviews } from "./interviewCount.ts";

const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

function application(interviews: Array<{ id: string; at: string }>): Application {
  return {
    id: "app-1",
    company: "Example",
    role: "Role",
    status: "Interviewing",
    appliedOn: "2026-09-01",
    location: "Remote",
    interviews: interviews.map((interview) => ({ ...interview, kind: "Panel" })),
  };
}

function at(stamp: string): Date {
  return interviewDate(stamp);
}

function loadBoard(): BoardFile {
  const file = new URL("../../public/data/applications.json", import.meta.url);
  return JSON.parse(readFileSync(file, "utf8")) as BoardFile;
}

/** Civil-time count. Interview stamps sort chronologically as strings. */
function recordedInFile(applications: readonly Application[], nowStamp: string): number {
  let recorded = 0;
  for (const application of applications) {
    for (const interview of application.interviews) {
      if (!DATE_TIME.test(interview.at)) continue;
      if (interview.at >= LAYOFF_AT && interview.at < nowStamp) recorded += 1;
    }
  }
  return recorded;
}

describe("countCompletedInterviews", () => {
  it("adds the two pre-layoff interviews that have no records", () => {
    expect(PRE_LAYOFF_INTERVIEWS).toBe(2);
    expect(countCompletedInterviews([], at("2026-11-12T12:00"))).toBe(2);
  });

  it("includes the layoff instant once it is in the past and skips earlier interviews", () => {
    const applications = [
      application([
        { id: "before", at: "2026-09-16T23:59" },
        { id: "layoff", at: LAYOFF_AT },
      ]),
    ];
    expect(countCompletedInterviews(applications, at(LAYOFF_AT))).toBe(2);
    expect(countCompletedInterviews(applications, at("2026-09-17T00:01"))).toBe(3);
  });

  it("skips interviews that are still upcoming, including one exactly at now", () => {
    const applications = [
      application([
        { id: "done", at: "2026-09-18T09:00" },
        { id: "now", at: "2026-10-01T12:00" },
        { id: "future", at: "2026-12-01T09:00" },
      ]),
    ];
    const now = at("2026-10-01T12:00");
    expect(countCompletedInterviews(applications, now)).toBe(3);
    expect(countCompletedInterviews(applications, new Date(now.getTime() + 60_000))).toBe(4);
  });

  it("counts every record once, including two interviews at the same time", () => {
    const applications = [
      application([
        { id: "a", at: "2026-10-02T09:00" },
        { id: "b", at: "2026-10-02T09:00" },
      ]),
      application([{ id: "c", at: "2026-10-03T09:00" }]),
    ];
    expect(countCompletedInterviews(applications, at("2026-10-04T00:00"))).toBe(5);
  });

  it("ignores timestamps that do not parse", () => {
    const applications = [
      application([
        { id: "bad", at: "not-a-date" },
        { id: "ok", at: "2026-10-01T09:00" },
      ]),
    ];
    expect(countCompletedInterviews(applications, at("2026-10-02T00:00"))).toBe(3);
  });

  it("still adds the pre-layoff interviews when now is before the layoff", () => {
    const applications = [application([{ id: "later", at: "2026-09-18T09:00" }])];
    expect(countCompletedInterviews(applications, at("2026-09-16T12:00"))).toBe(2);
  });

  it("matches the published board around the 2026-11-12 interviews", () => {
    const board = loadBoard();
    const beforeTen = "2026-11-12T10:00";
    const afterTen = "2026-11-12T10:01";
    const beforeEleven = "2026-11-12T11:00";
    const afterEleven = "2026-11-12T11:01";

    expect(recordedInFile(board.applications, beforeTen)).toBe(23);
    expect(countCompletedInterviews(board.applications, at(beforeTen))).toBe(25);

    expect(recordedInFile(board.applications, afterTen)).toBe(24);
    expect(countCompletedInterviews(board.applications, at(afterTen))).toBe(26);

    expect(recordedInFile(board.applications, beforeEleven)).toBe(24);
    expect(countCompletedInterviews(board.applications, at(beforeEleven))).toBe(26);

    expect(recordedInFile(board.applications, afterEleven)).toBe(25);
    expect(countCompletedInterviews(board.applications, at(afterEleven))).toBe(27);

    for (const stamp of [beforeTen, afterTen, beforeEleven, afterEleven]) {
      expect(countCompletedInterviews(board.applications, at(stamp))).toBe(
        recordedInFile(board.applications, stamp) + PRE_LAYOFF_INTERVIEWS,
      );
    }
  });
});
