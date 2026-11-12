import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applySharedOperation, applicationSignature, parseBoard } from "./_lib/boardFile.ts";

const text = readFileSync(new URL("../public/data/applications.json", import.meta.url), "utf8");

describe("published applications", () => {
  it("has the eight new November 12 applications and leaves every previous entry unchanged", () => {
    const board = parseBoard(JSON.parse(text));
    expect(board.applications).toHaveLength(251);
    expect(board.updatedAt).toBe("2026-11-12T16:21:00Z");
    const added = [
      "protagona-aws-cloud-engineer",
      "filevine-security-specialist-intern",
      "innovative-solutions-cloud-engineer",
      "gurobi-technical-account-manager",
      "safe-security-forward-deployed-engineer",
      "leidos-cloud-infrastructure-engineer",
      "verisk-development-operations-engineer",
      "microsoft-csa-cloud-ai-infrastructure-dib",
    ];
    for (const id of added) {
      const app = board.applications.find((item) => item.id === id);
      expect(app?.status).toBe("Applied");
      expect(app?.appliedOn).toBe("2026-11-12");
      expect(app?.notes).toBeTruthy();
      expect(app?.jobUrl).toMatch(/^https:\/\//);
      expect(app?.interviews).toEqual([]);
    }
    expect(board.applications.at(-1)?.id).toBe("microsoft-csa-cloud-ai-infrastructure-dib");
    const earlierMicrosoft = board.applications.find((item) => item.id === "microsoft-csa-cloud-ai");
    expect(earlierMicrosoft?.jobUrl).toBe(
      "https://apply.careers.microsoft.com/careers/job/1970393556958392",
    );
    const illumio = board.applications.find((item) => item.id === "illumio-sr-tam");
    expect(illumio?.status).toBe("Interviewing");
    expect(illumio?.notes).toMatch(/Recruiter screen completed Nov 12\.$/);
    expect(illumio?.interviews.map((item) => item.id)).toEqual([
      "illumio-sr-tam-recruiter-screen",
      "illumio-sr-tam-interview-2",
    ]);
    expect(illumio?.interviews[1]).toEqual({
      id: "illumio-sr-tam-interview-2",
      at: "2026-11-13T14:00",
      kind: "Interview (45 min)",
    });

    const marker = '\n    {\n      "id": "movate-technical-support-specialist"';
    const at = text.indexOf(marker);
    expect(at).toBeGreaterThan(0);
    expect(text[at - 1]).toBe(",");
    const restored = text
      .slice(0, at - 1)
      .concat("\n  ]\n}\n")
      .replace('  "updatedAt": "2026-11-12T16:21:00Z",', '  "updatedAt": "2026-11-11T21:39:13Z",')
      .replace(
        `},
        {
          "id": "illumio-sr-tam-interview-2",
          "at": "2026-11-13T14:00",
          "kind": "Interview (45 min)"
        }
      ],
      "notes": "Applied Nov 11, 2026 via Ashby (TAM resume). Pay $148K–$177K. Nov 11, 2026: Recruiter screening scheduled for Thu Nov 12, 2026 at 8:30 AM MT. Recruiter screen completed Nov 12."`,
        `}
      ],
      "notes": "Applied Nov 11, 2026 via Ashby (TAM resume). Pay $148K–$177K. Nov 11, 2026: Recruiter screening scheduled for Thu Nov 12, 2026 at 8:30 AM MT."`,
      );
    expect(createHash("sha256").update(restored).digest("hex")).toBe(
      "ddd7c3fa65183ba9e5f19029adb705c599d10bbd0412fbbc366407c22d4c4553",
    );
  });
});

describe("applySharedOperation", () => {
  const raw = `${JSON.stringify(
    {
      version: 1,
      owner: "Lee Denning",
      updatedAt: "2026-11-01T00:00:00.000Z",
      applications: [
        {
          id: "app-one",
          company: "Acme",
          role: "Engineer",
          status: "Applied",
          appliedOn: "2026-10-01",
          location: "Remote",
          notes: "Keep me",
          interviews: [{ id: "int-1", at: "2026-10-02T09:00", kind: "Recruiter screen" }],
        },
      ],
    },
    null,
    2,
  )}\n`;

  it("normalizes a form payload without dropping notes, interviews, location, or appliedOn", () => {
    const result = applySharedOperation(
      raw,
      {
        op: "upsert",
        application: {
          id: "app-one",
          company: " Acme ",
          role: " Engineer ",
          status: " Ghosted ",
          appliedOn: " 2026-10-01 ",
          location: " South Jordan, UT ",
          notes: "  posted pay  ",
          jobUrl: " https://example.com/job ",
          interviews: [{ id: "int-9", at: "2026-11-20T10:00:30", kind: " Panel " }],
        },
      },
      "2026-11-12T14:00:00.000Z",
    );
    const saved = result.application;
    expect(saved).toMatchObject({
      id: "app-one",
      company: "Acme",
      role: "Engineer",
      status: "Ghosted",
      appliedOn: "2026-10-01",
      location: "South Jordan, UT",
      notes: "posted pay",
      jobUrl: "https://example.com/job",
    });
    expect(saved?.interviews).toEqual([{ id: "int-9", at: "2026-11-20T10:00", kind: "Panel" }]);
    const other = parseBoard(JSON.parse(raw)).applications[0]!;
    const after = parseBoard(JSON.parse(result.text)).applications;
    expect(after).toHaveLength(1);
    expect(applicationSignature(after[0]!)).not.toBe(applicationSignature(other));
  });

  it("gives a new entry an id that is not already on the board", () => {
    const result = applySharedOperation(
      raw,
      {
        op: "upsert",
        application: {
          company: "Movate",
          role: "Support",
          status: "Applied",
          appliedOn: "2026-11-11",
          location: "",
          notes: "",
          jobUrl: "",
          interviews: [],
        },
      },
      "2026-11-12T14:00:00.000Z",
    );
    expect(result.application?.id).toBeTruthy();
    expect(result.application?.id).not.toBe("app-one");
    expect(result.application?.notes).toBeUndefined();
    expect(result.application?.jobUrl).toBeUndefined();
    expect(result.application?.location).toBe("");
    const apps = parseBoard(JSON.parse(result.text)).applications;
    expect(apps.map((app) => app.id)).toContain("app-one");
    expect(new Set(apps.map((app) => app.id)).size).toBe(apps.length);
  });

  it("rejects an impossible interview time and accepts an empty interview list", () => {
    expect(() =>
      applySharedOperation(
        raw,
        {
          op: "upsert",
          application: {
            id: "app-one",
            company: "Acme",
            role: "Engineer",
            status: "Applied",
            appliedOn: "2026-10-01",
            location: "Remote",
            interviews: [{ id: "int-x", at: "2026-11-20T99:99", kind: "Panel" }],
          },
        },
        "2026-11-12T14:00:00.000Z",
      ),
    ).toThrow(/date and time/);

    const cleared = applySharedOperation(
      raw,
      {
        op: "upsert",
        application: {
          id: "app-one",
          company: "Acme",
          role: "Engineer",
          status: "Applied",
          appliedOn: "2026-10-01",
          location: "Remote",
          notes: "   ",
          interviews: [],
        },
      },
      "2026-11-12T14:00:00.000Z",
    );
    expect(cleared.application?.interviews).toEqual([]);
    expect(cleared.application?.notes).toBeUndefined();
  });
});
