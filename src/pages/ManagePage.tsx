import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApplicationDialog } from "../components/ApplicationDialog.tsx";
import { BoardList } from "../components/BoardList.tsx";
import { PlusIcon } from "../components/Icons.tsx";
import { ManageLock } from "../components/ManageLock.tsx";
import { Shell } from "../components/Shell.tsx";
import { BoardSkeleton } from "../components/Skeleton.tsx";
import { Summary } from "../components/Summary.tsx";
import {
  boardSignature,
  copyText,
  downloadBoard,
  localDrifts,
  removeApplication,
  serializeBoard,
  upsertApplication,
  type LocalDrift,
} from "../lib/board.ts";
import { loadPublished, readBoardFile } from "../lib/load.ts";
import { clearManagePassword, isManageUnlocked, passwordMatches, readManagePassword, unlockManage } from "../lib/manageAuth.ts";
import { publishOperation, type PublishResult } from "../lib/publish.ts";
import { btnPrimary, btnSecondary, cx, fieldClass } from "../lib/styles.ts";
import { clearDraft, readDraft, saveDraft } from "../lib/storage.ts";
import { useNow } from "../lib/useNow.ts";
import type { Application, BoardFile } from "../types.ts";

const SAVED_MESSAGE = "Saved to the shared board. Visitors see it in about a minute.";

export function ManagePage() {
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";
  const [unlocked, setUnlocked] = useState(() => isManageUnlocked());
  if (!unlocked) {
    return <ManageLock embed={embed} onUnlock={() => setUnlocked(true)} />;
  }
  return <ManageEditor />;
}

function failureMessage(result: Extract<PublishResult, { ok: false }>, fallback: string): string {
  if (result.reason === "not_configured") {
    return "Saved only in this browser. Shared saving isn't configured on the server yet.";
  }
  if (result.reason === "network") {
    return "Saved only in this browser. Couldn't reach the shared board.";
  }
  if (result.reason === "unauthorized") {
    return "Saved only in this browser. The password was rejected, so nothing was published.";
  }
  if (result.message && result.message !== "The shared board was not updated.") {
    return `Saved only in this browser. ${result.message}`;
  }
  return fallback;
}

function editedOwner(current: BoardFile, published: BoardFile | null): string | undefined {
  if (!published) return undefined;
  const next = current.owner.trim();
  if (!next || next === published.owner.trim()) return undefined;
  return next;
}

function restoreRemoved(board: BoardFile, published: BoardFile, id: string): BoardFile {
  const original = published.applications.find((app) => app.id === id);
  if (!original) return board;
  if (board.applications.some((app) => app.id === id)) return upsertApplication(board, original);
  const index = published.applications.findIndex((app) => app.id === id);
  const applications = [...board.applications];
  applications.splice(Math.min(Math.max(index, 0), applications.length), 0, original);
  return { ...board, applications };
}

function ManageEditor() {
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";
  const now = useNow();
  const [published, setPublished] = useState<BoardFile | null>(null);
  const [board, setBoard] = useState<BoardFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Application | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState<((password: string | null) => void) | null>(null);
  const boardRef = useRef(board);
  const publishedRef = useRef(published);
  const busyRef = useRef(false);

  useEffect(() => {
    boardRef.current = board;
    publishedRef.current = published;
  });

  const setWorking = (value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  };

  const applyFile = (file: BoardFile) => {
    const draft = readDraft();
    setPublished(file);
    setError(null);
    if (draft && boardSignature(draft) !== boardSignature(file)) {
      setBoard(draft);
      return;
    }
    if (draft) clearDraft();
    setBoard(file);
  };

  const reload = () => {
    setLoading(true);
    setError(null);
    loadPublished()
      .then(applyFile)
      .catch((err: unknown) => {
        const draft = readDraft();
        if (draft) {
          setBoard(draft);
          setPublished(null);
          setError(null);
          setNotice("Couldn't refresh the shared file. Showing the copy in this browser.");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load the board.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    loadPublished()
      .then((file) => {
        if (!cancelled) applyFile(file);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const draft = readDraft();
        if (draft) {
          setBoard(draft);
          setPublished(null);
          setNotice("Couldn't refresh the shared file. Showing the copy in this browser.");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load the board.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.title = "Manage · Job search";
  }, []);

  const dirty = useMemo(() => {
    if (!board) return false;
    if (!published) return true;
    return boardSignature(board) !== boardSignature(published);
  }, [board, published]);

  const drifts = useMemo(() => {
    if (!board || !published) return [];
    return localDrifts(board, published);
  }, [board, published]);

  const remember = (nextBoard: BoardFile, nextPublished: BoardFile | null) => {
    setBoard(nextBoard);
    setPublished(nextPublished);
    boardRef.current = nextBoard;
    publishedRef.current = nextPublished;
    if (nextPublished && boardSignature(nextBoard) === boardSignature(nextPublished)) clearDraft();
    else saveDraft(nextBoard);
  };

  const ensurePassword = () => {
    const existing = readManagePassword();
    if (existing) return Promise.resolve(existing);
    return new Promise<string | null>((resolve) => {
      setPrompt(() => resolve);
    });
  };

  const saveApplication = async (application: Application) => {
    if (busyRef.current || !boardRef.current) return;
    setWorking(true);
    try {
      const password = await ensurePassword();
      const latest = boardRef.current;
      const latestPublished = publishedRef.current;
      if (!latest) return;
      if (!password) {
        remember(upsertApplication(latest, application), latestPublished);
        setEditing(undefined);
        setNotice("Saved only in this browser. Enter the password to publish to the shared board.");
        return;
      }
      const owner = editedOwner(latest, latestPublished);
      const result = await publishOperation({ password, op: "upsert", application, owner });
      const fresh = boardRef.current ?? latest;
      const freshPublished = publishedRef.current;
      if (result.ok && result.application) {
        const nextOwner = owner !== undefined && fresh.owner.trim() === owner ? result.owner : undefined;
        remember(
          upsertApplication(fresh, result.application, nextOwner),
          freshPublished ? upsertApplication(freshPublished, result.application, nextOwner) : freshPublished,
        );
        setNotice(SAVED_MESSAGE);
      } else if (result.ok) {
        remember(upsertApplication(fresh, application), freshPublished);
        setNotice("Saved only in this browser. The shared board did not return the application.");
      } else {
        if (result.reason === "unauthorized") clearManagePassword();
        remember(upsertApplication(fresh, application), freshPublished);
        setNotice(failureMessage(result, "Saved only in this browser. The shared board was not updated."));
      }
      setEditing(undefined);
    } finally {
      setWorking(false);
    }
  };

  const deleteApplication = async (id: string) => {
    if (busyRef.current || !boardRef.current) return;
    setWorking(true);
    try {
      const password = await ensurePassword();
      const latest = boardRef.current;
      const latestPublished = publishedRef.current;
      if (!latest) return;
      if (!password) {
        remember(removeApplication(latest, id), latestPublished);
        setEditing(undefined);
        setNotice("Saved only in this browser. Enter the password to publish to the shared board.");
        return;
      }
      const owner = editedOwner(latest, latestPublished);
      const result = await publishOperation({ password, op: "delete", id, owner });
      const fresh = boardRef.current ?? latest;
      const freshPublished = publishedRef.current;
      const alreadyGone = !result.ok && result.reason === "not_found";
      if (result.ok || alreadyGone) {
        const nextOwner = result.ok && owner !== undefined && fresh.owner.trim() === owner ? result.owner : undefined;
        remember(
          removeApplication(fresh, id, nextOwner),
          freshPublished ? removeApplication(freshPublished, id, nextOwner) : freshPublished,
        );
        setNotice(result.ok ? SAVED_MESSAGE : "That application is already gone from the shared board.");
      } else {
        if (result.reason === "unauthorized") clearManagePassword();
        remember(removeApplication(fresh, id), freshPublished);
        setNotice(failureMessage(result, "Saved only in this browser. The shared board was not updated."));
      }
      setEditing(undefined);
    } finally {
      setWorking(false);
    }
  };

  const discardDrift = (drift: LocalDrift) => {
    const current = boardRef.current;
    const latestPublished = publishedRef.current;
    if (!current || !latestPublished || busy) return;
    let next = current;
    if (drift.kind === "added") next = removeApplication(current, drift.id);
    else if (drift.kind === "removed") next = restoreRemoved(current, latestPublished, drift.id);
    else {
      const original = latestPublished.applications.find((app) => app.id === drift.id);
      if (original) next = upsertApplication(current, original);
    }
    remember(next, latestPublished);
    setNotice("Discarded that local edit.");
  };

  const exportJson = () => {
    if (!board || !board.owner.trim()) {
      setNotice("Add a name before exporting.");
      return;
    }
    downloadBoard(board);
    setNotice("Downloaded applications.json. Replace public/data/applications.json only if you need a file backup.");
  };

  const copyJson = async () => {
    if (!board || !board.owner.trim()) {
      setNotice("Add a name before copying.");
      return;
    }
    try {
      await copyText(serializeBoard(board));
      setNotice("Copied applications.json. Keep it as a backup, or paste it over the shared file if saving from here fails.");
    } catch {
      setNotice("Couldn't copy. Use Export JSON instead.");
    }
  };

  const importJson = async (file: File | undefined) => {
    if (!file || !board) return;
    try {
      const next = await readBoardFile(file);
      remember(next, published);
      setNotice(
        `Imported ${next.applications.length} applications into this browser. Publish them one at a time, or export JSON as a backup.`,
      );
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : "Couldn't import that file.");
    }
  };

  const discard = () => {
    if (!published || busy) return;
    clearDraft();
    setBoard(published);
    boardRef.current = published;
    setNotice("Restored the shared board.");
  };

  const ownerChanged = Boolean(board && published && board.owner.trim() !== published.owner.trim());

  return (
    <Shell
      title="Manage"
      subtitle="Each save publishes one application."
      embed={embed}
      actions={
        <>
          <Link to="/" className={`${btnSecondary} no-print`}>
            View shared board
          </Link>
          <button type="button" className={`${btnPrimary} no-print`} onClick={() => setEditing(null)} disabled={!board || busy}>
            <PlusIcon className="h-4 w-4" />
            Add application
          </button>
        </>
      }
      footer={<p>A published change shows up for visitors about a minute later. Export JSON if you want a file backup.</p>}
    >
      {loading ? <BoardSkeleton /> : null}
      {!loading && error ? (
        <div className="rounded-[22px] bg-white px-6 py-16 text-center border-[3px] border-black">
          <h2 className="text-lg font-semibold">The board didn't load</h2>
          <p className="mt-2 text-sm text-muted">{error}</p>
          <button type="button" onClick={reload} className="mt-5 text-sm font-semibold underline underline-offset-4">
            Try again
          </button>
        </div>
      ) : null}
      {!loading && board ? (
        <div className="space-y-4">
          <section
            className={cx(
              "rounded-[22px] bg-white p-4 border-[3px] border-black sm:p-5",
              dirty ? "shadow-[inset_3px_0_0_#e0b15a]" : "shadow-[inset_3px_0_0_#3dbe84]",
            )}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">Publish</h2>
                  <span
                    className={cx(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      dirty ? "bg-[#f6efe3] text-quiet" : "bg-[#e3f5eb] text-live",
                    )}
                  >
                    {dirty ? "Local changes" : "Matches shared board"}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-5 text-muted">
                  Saving or deleting an application publishes that one change to the shared board. Visitors see it
                  about a minute later. Export, Copy JSON, and Import stay here as backups. If publishing can't reach
                  GitHub, the edit stays in this browser.
                </p>
                {ownerChanged ? (
                  <p className="mt-2 text-sm text-muted">
                    The name change stays in this browser until you publish an application.
                  </p>
                ) : null}
                {notice ? (
                  <p className="mt-2 text-sm font-medium text-ink" role="status">
                    {notice}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={btnPrimary} onClick={exportJson}>
                  Export JSON
                </button>
                <button type="button" className={btnSecondary} onClick={() => void copyJson()}>
                  Copy JSON
                </button>
                <label className={`${btnSecondary} cursor-pointer`}>
                  Import
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void importJson(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                <button type="button" className={btnSecondary} onClick={discard} disabled={!dirty || !published || busy}>
                  Discard local edits
                </button>
              </div>
            </div>
            <label className="mt-4 flex max-w-md flex-col gap-1.5 text-xs font-semibold text-muted">
              Name on the board
              <input
                value={board.owner}
                maxLength={80}
                disabled={busy}
                onChange={(event) => remember({ ...board, owner: event.target.value }, published)}
                className={fieldClass}
              />
            </label>
          </section>
          {drifts.length > 0 ? (
            <section className="rounded-[22px] border-[3px] border-black bg-white p-4 shadow-[inset_3px_0_0_#e0b15a] sm:p-5">
              <h2 className="text-base font-semibold">Local edits not on the shared board</h2>
              <p className="mt-1.5 max-w-xl text-sm leading-5 text-muted">
                These differ from the published file. Publish one application at a time so other updates are left
                alone. Nothing here replaces the whole file.
              </p>
              <ul className="mt-4 space-y-2">
                {drifts.map((drift) => (
                  <li
                    key={drift.id}
                    className="flex flex-col gap-3 rounded-xl border-[3px] border-black bg-[#d4f3e4] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {drift.application.company}
                        <span className="ml-2 font-medium text-muted">
                          {drift.kind === "added" ? "New" : drift.kind === "removed" ? "Removed" : "Edited"}
                        </span>
                      </p>
                      <p className="text-sm text-muted">{drift.application.role}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={btnPrimary}
                        disabled={busy}
                        onClick={() => {
                          if (drift.kind === "removed") void deleteApplication(drift.id);
                          else void saveApplication(drift.application);
                        }}
                      >
                        {drift.kind === "removed" ? "Publish removal" : "Publish this one"}
                      </button>
                      <button type="button" className={btnSecondary} disabled={busy} onClick={() => discardDrift(drift)}>
                        Discard
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <Summary applications={board.applications} now={now} />
          <BoardList
            applications={board.applications}
            now={now}
            showNotes
            onEdit={(application) => setEditing(application)}
            onDelete={(application) => {
              void deleteApplication(application.id);
            }}
            onAdd={() => setEditing(null)}
          />
        </div>
      ) : null}
      {editing !== undefined && board ? (
        <ApplicationDialog
          key={editing?.id ?? "new"}
          application={editing}
          onClose={() => setEditing(undefined)}
          onSave={saveApplication}
          onDelete={editing ? () => deleteApplication(editing.id) : undefined}
        />
      ) : null}
      {prompt ? (
        <PasswordReprompt
          onCancel={() => {
            const resolve = prompt;
            setPrompt(null);
            resolve(null);
          }}
          onSubmit={(password) => {
            const resolve = prompt;
            setPrompt(null);
            resolve(password);
          }}
        />
      ) : null}
    </Shell>
  );
}

function PasswordReprompt({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const ok = await passwordMatches(password);
      if (!ok) {
        setError("Wrong password.");
        return;
      }
      const typed = password;
      setPassword("");
      unlockManage(typed);
      onSubmit(typed);
    } catch {
      setError("Couldn't check the password. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#17191c]/40 p-4">
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        className="w-full max-w-md rounded-[22px] border-[3px] border-black bg-white p-5 sm:p-6"
      >
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">Enter the password again</h2>
        <p className="mt-1.5 text-sm leading-5 text-muted">
          This browser doesn't have the password from unlock anymore. It's needed to publish this change.
        </p>
        <label className="mt-5 flex flex-col gap-1.5 text-xs font-semibold text-muted">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) setError(null);
            }}
            className="h-11 w-full rounded-xl border-[3px] border-black bg-white px-3 text-sm text-ink outline-none"
          />
        </label>
        {error ? (
          <p role="alert" className="mt-3 text-sm font-semibold text-closed">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex gap-2">
          <button type="submit" className={btnPrimary} disabled={pending}>
            {pending ? "Checking…" : "Continue"}
          </button>
          <button type="button" className={btnSecondary} onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
