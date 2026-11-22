import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import type { Application, BoardFile } from "../types.ts";
import {
  countNotHiredSplits,
  hadInterview,
  sortApplications,
} from "./board.ts";

function application(overrides: Partial<Application> = {}): Application {
  return {
    id: "app-1",
    company: "Example",
    role: "Role",
    status: "Not hired",
    appliedOn: "2026-09-01",
    location: "Remote",
    interviews: [],
    ...overrides,
  };
}

describe("hadInterview", () => {
  it("is true when the interviews array is non-empty", () => {
    const app = application({
      interviews: [{ id: "i1", at: "2026-09-15T10:00", kind: "Recruiter screen" }],
    });
    expect(hadInterview(app)).toBe(true);
  });

  it("is false for an empty interviews array and no interview notes", () => {
    expect(hadInterview(application({ notes: "Rejected Sep 1 after applying." }))).toBe(false);
  });

  it("treats clear completed-interview notes as interviewed for Not hired rows", () => {
    expect(hadInterview(application({ notes: "Post-interview reject Jul 9; apply date approx" }))).toBe(true);
    expect(hadInterview(application({ notes: "Rejected Aug 16 after HM interview; apply date approx" }))).toBe(true);
    expect(hadInterview(application({ notes: "Rejected Sep 15 after AI interview" }))).toBe(true);
    expect(hadInterview(application({ notes: "Interviewed ~Sep 24; not hired Sep 28" }))).toBe(true);
  });

  it("does not treat vague or declined-interview notes as a completed interview", () => {
    expect(
      hadInterview(application({ notes: "Lee confirmed Oct 7: not moving forward with interview." })),
    ).toBe(false);
    expect(
      hadInterview(application({ notes: "Direct Adobe Workday app — separate from Mindlance panel" })),
    ).toBe(false);
  });

  it("does not use notes for statuses other than Not hired", () => {
    expect(
      hadInterview(
        application({ status: "Applied", notes: "Interviewed last week, waiting to hear back." }),
      ),
    ).toBe(false);
  });
});

describe("countNotHiredSplits", () => {
  it("splits Not hired rows by interview history and ignores other statuses", () => {
    const now = new Date("2026-11-22T20:00:00Z");
    const apps = [
      application({
        id: "a",
        interviews: [{ id: "i1", at: "2026-09-15T10:00", kind: "Recruiter screen" }],
      }),
      application({ id: "b", notes: "Post-interview reject Jul 9" }),
      application({ id: "c", notes: "Rejected without a conversation" }),
      application({ id: "d", status: "Applied", appliedOn: "2026-11-01" }),
    ];
    expect(countNotHiredSplits(apps, now)).toEqual({ afterInterviewing: 2, noInterview: 1 });
  });
});

describe("default sort groups Not hired sections", () => {
  it("places after-interviewing Not hired rows before no-interview rows", () => {
    const now = new Date("2026-11-22T20:00:00Z");
    const none = application({ id: "none", company: "Zebra", appliedOn: "2026-11-20" });
    const after = application({
      id: "after",
      company: "Acme",
      appliedOn: "2026-09-01",
      interviews: [{ id: "i1", at: "2026-09-15T10:00", kind: "Recruiter screen" }],
    });
    const sorted = sortApplications([none, after], null, now);
    expect(sorted.map((app) => app.id)).toEqual(["after", "none"]);
  });
});

describe("published board split", () => {
  it("counts every Not hired row and includes notes-only completed interviews", () => {
    const file = new URL("../../public/data/applications.json", import.meta.url);
    const board = JSON.parse(readFileSync(file, "utf8")) as BoardFile;
    const now = new Date("2026-11-22T21:17:22Z");
    const notHired = board.applications.filter((app) => app.status === "Not hired");
    const split = countNotHiredSplits(board.applications, now);
    expect(split.afterInterviewing + split.noInterview).toBe(notHired.length);
    const notesOnly = ["Together AI", "Glean", "Akeyless Security", "LiveKit"];
    for (const company of notesOnly) {
      const app = notHired.find((row) => row.company === company);
      expect(app, company).toBeTruthy();
      expect(app!.interviews).toEqual([]);
      expect(hadInterview(app!)).toBe(true);
    }
    expect(hadInterview(notHired.find((row) => row.company === "SambaNova")!)).toBe(false);
  });
});
