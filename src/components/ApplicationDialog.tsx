import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { normalizeJobUrl, todayISO } from "../lib/board.ts";
import { STATUS_META } from "../lib/status.ts";
import { btnPrimary, btnSecondary, cx, fieldClass } from "../lib/styles.ts";
import { INTERVIEW_KINDS, STATUSES, type Application, type ApplicationStatus, type Interview } from "../types.ts";
import { CloseIcon } from "./Icons.tsx";
import { ModalFrame } from "./ModalFrame.tsx";

type InterviewDraft = {
  id: string;
  kind: string;
  date: string;
  time: string;
};

type Draft = {
  id: string;
  company: string;
  role: string;
  jobUrl: string;
  status: ApplicationStatus;
  appliedOn: string;
  location: string;
  notes: string;
  interviews: InterviewDraft[];
};

type ApplicationDialogProps = {
  application: Application | null;
  onClose: () => void;
  onSave: (application: Application) => void | Promise<void | string>;
  onDelete?: () => void | Promise<void | string>;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function splitAt(at: string): { date: string; time: string } {
  const [date = "", time = ""] = at.split("T");
  return { date, time: time.slice(0, 5) };
}

function toDraft(application: Application | null): Draft {
  if (!application) {
    return {
      id: crypto.randomUUID(),
      company: "",
      role: "",
      jobUrl: "",
      status: "Applied",
      appliedOn: todayISO(),
      location: "",
      notes: "",
      interviews: [],
    };
  }
  return {
    id: application.id,
    company: application.company,
    role: application.role,
    jobUrl: application.jobUrl ?? "",
    status: application.status,
    appliedOn: application.appliedOn,
    location: application.location,
    notes: application.notes ?? "",
    interviews: application.interviews.map((interview) => {
      const parts = splitAt(interview.at);
      return { id: interview.id, kind: interview.kind, date: parts.date, time: parts.time };
    }),
  };
}

export function ApplicationDialog({ application, onClose, onSave, onDelete }: ApplicationDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft>(() => toDraft(application));
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<"save" | "delete" | null>(null);

  useEffect(() => {
    companyRef.current?.focus();
  }, []);

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = [...node.querySelectorAll<HTMLElement>("button, input, textarea, select")].filter(
        (item) => !item.hasAttribute("disabled"),
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [onClose]);

  const updateInterview = (id: string, patch: Partial<InterviewDraft>) => {
    setDraft((current) => ({
      ...current,
      interviews: current.interviews.map((interview) =>
        interview.id === id ? { ...interview, ...patch } : interview,
      ),
    }));
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (pending) return;
    const company = draft.company.trim();
    const role = draft.role.trim();
    if (!company || !role) {
      setError("Company and role are required.");
      return;
    }
    if (!DATE_ONLY.test(draft.appliedOn)) {
      setError("Add the date you applied.");
      return;
    }
    const jobUrl = normalizeJobUrl(draft.jobUrl);
    if (jobUrl === null) {
      setError("Job posting URL must start with http:// or https://.");
      return;
    }
    const interviews: Interview[] = [];
    for (const interview of draft.interviews) {
      const kind = interview.kind.trim();
      if (!kind || !interview.date || !interview.time) {
        setError("Each interview needs a name, date, and time.");
        return;
      }
      interviews.push({
        id: interview.id,
        kind,
        at: `${interview.date}T${interview.time.slice(0, 5)}`,
      });
    }
    interviews.sort((a, b) => a.at.localeCompare(b.at));
    const notes = draft.notes.trim();
    setPending("save");
    setError(null);
    try {
      const message = await onSave({
        id: draft.id,
        company,
        role,
        ...(jobUrl ? { jobUrl } : {}),
        status: draft.status,
        appliedOn: draft.appliedOn,
        location: draft.location.trim(),
        ...(notes ? { notes } : {}),
        interviews,
      });
      if (typeof message === "string" && message) setError(message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Couldn't save that application.");
    } finally {
      setPending(null);
    }
  };

  return (
    <ModalFrame onDismiss={pending ? undefined : onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[min(100dvh-2rem,860px)] w-full flex-col overflow-hidden rounded-[28px] border-[3px] border-black bg-white"
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
          <div>
            <h2 id={titleId} className="text-xl font-semibold tracking-[-0.03em]">
              {application ? "Edit application" : "Add application"}
            </h2>
            <p className="mt-1 text-sm text-muted">Publishes this one application to the shared board.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-soft hover:text-ink"
          >
            <CloseIcon />
          </button>
        </div>

        <form
          id="application-form"
          onSubmit={(event) => {
            void submit(event);
          }}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4"
        >
          {error ? (
            <p className="rounded-xl bg-[var(--chip-closed-bg)] px-3 py-2 text-sm text-closed" role="alert">
              {error}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-muted">
              Company
              <input
                ref={companyRef}
                value={draft.company}
                onChange={(event) => setDraft({ ...draft, company: event.target.value })}
                className={cx(fieldClass, "mt-1.5")}
                maxLength={120}
                required
              />
            </label>
            <label className="block text-xs font-semibold text-muted">
              Role
              <input
                value={draft.role}
                onChange={(event) => setDraft({ ...draft, role: event.target.value })}
                className={cx(fieldClass, "mt-1.5")}
                maxLength={120}
                required
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-muted">
            Job posting URL
            <input
              type="url"
              inputMode="url"
              value={draft.jobUrl}
              onChange={(event) => setDraft({ ...draft, jobUrl: event.target.value })}
              placeholder="https://company.com/careers/role"
              autoComplete="off"
              spellCheck={false}
              maxLength={2000}
              className={cx(fieldClass, "mt-1.5")}
            />
          </label>

          <fieldset>
            <legend className="text-xs font-semibold text-muted">Status</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {STATUSES.map((status) => {
                const selected = draft.status === status;
                return (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDraft({ ...draft, status })}
                    className={cx(
                      "inline-flex min-h-11 items-center gap-2 rounded-xl border-[3px] border-black px-3 py-2.5 text-left text-sm font-medium transition-colors",
                      selected ? "bg-fill text-[#ffffff]" : "bg-white text-ink hover:bg-soft",
                    )}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: STATUS_META[status].text }}
                      aria-hidden="true"
                    />
                    {status}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-muted">
              Applied
              <input
                type="date"
                value={draft.appliedOn}
                onChange={(event) => setDraft({ ...draft, appliedOn: event.target.value })}
                className={cx(fieldClass, "mt-1.5")}
                required
              />
            </label>
            <label className="block text-xs font-semibold text-muted">
              Location
              <input
                value={draft.location}
                onChange={(event) => setDraft({ ...draft, location: event.target.value })}
                placeholder="New York · Hybrid"
                className={cx(fieldClass, "mt-1.5")}
                maxLength={120}
              />
            </label>
          </div>

          <label className="block text-xs font-semibold text-muted">
            Private note
            <textarea
              value={draft.notes}
              onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              rows={3}
              maxLength={2000}
              placeholder="Follow-ups, names, what to prepare"
              className="mt-1.5 w-full resize-y rounded-xl border-[3px] border-black bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-ink/30 focus:ring-2 focus:ring-ink/10"
            />
            <span className="mt-1 block font-normal">
              Hidden on the shared page. The JSON file is still public, so leave out anything you would not put in the repo.
            </span>
          </label>

          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold text-muted">
                Interviews <span className="num">{draft.interviews.length}</span>
              </h3>
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    interviews: [
                      ...current.interviews,
                      { id: crypto.randomUUID(), kind: "Recruiter screen", date: "", time: "10:00" },
                    ],
                  }))
                }
                className="inline-flex min-h-11 items-center text-sm font-semibold text-ink underline decoration-ink/30 underline-offset-4"
              >
                Add interview
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {draft.interviews.length === 0 ? (
                <p className="rounded-xl bg-soft px-3 py-3 text-sm text-muted">No interviews yet.</p>
              ) : (
                draft.interviews.map((interview, index) => (
                  <div key={interview.id} className="rounded-xl bg-soft p-3">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_112px_auto]">
                      <label className="sr-only" htmlFor={`${interview.id}-kind`}>
                        Interview {index + 1} kind
                      </label>
                      <input
                        id={`${interview.id}-kind`}
                        list="interview-kinds"
                        value={interview.kind}
                        onChange={(event) => updateInterview(interview.id, { kind: event.target.value })}
                        placeholder="Recruiter screen"
                        maxLength={80}
                        className={fieldClass}
                      />
                      <input
                        type="date"
                        aria-label={`Interview ${index + 1} date`}
                        value={interview.date}
                        onChange={(event) => updateInterview(interview.id, { date: event.target.value })}
                        className={fieldClass}
                      />
                      <input
                        type="time"
                        aria-label={`Interview ${index + 1} time`}
                        value={interview.time}
                        onChange={(event) => updateInterview(interview.id, { time: event.target.value })}
                        className={fieldClass}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            interviews: current.interviews.filter((item) => item.id !== interview.id),
                          }))
                        }
                        className="h-11 min-h-11 rounded-xl border-[3px] border-black bg-white px-3 text-sm font-semibold text-ink hover:text-closed"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <datalist id="interview-kinds">
              {INTERVIEW_KINDS.map((kind) => (
                <option key={kind} value={kind} />
              ))}
            </datalist>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t-[3px] border-black px-6 py-4">
          <div>
            {onDelete && !confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={pending !== null}
                className="text-sm font-semibold text-closed disabled:opacity-40"
              >
                Delete
              </button>
            ) : null}
            {onDelete && confirming ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Delete this application?</span>
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => {
                    if (pending) return;
                    setPending("delete");
                    setError(null);
                    void Promise.resolve(onDelete())
                      .then((message) => {
                        if (typeof message === "string" && message) setError(message);
                      })
                      .catch((err: unknown) => {
                        setError(err instanceof Error ? err.message : "Couldn't delete that application.");
                      })
                      .finally(() => setPending(null));
                  }}
                  className="font-semibold text-closed disabled:opacity-40"
                >
                  {pending === "delete" ? "Deleting…" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={pending !== null}
                  className="font-semibold text-muted disabled:opacity-40"
                >
                  Keep
                </button>
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={btnSecondary} disabled={pending !== null}>
              Cancel
            </button>
            <button
              type="submit"
              form="application-form"
              className={btnPrimary}
              disabled={pending !== null}
              onClick={(event) => {
                const form = document.getElementById("application-form");
                if (!(form instanceof HTMLFormElement)) return;
                if (event.currentTarget.form === form) return;
                event.preventDefault();
                form.requestSubmit();
              }}
            >
              {pending === "save" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </ModalFrame>
  );
}
