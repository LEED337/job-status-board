import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ApplicationDialog } from "../components/ApplicationDialog.tsx";
import { BoardList } from "../components/BoardList.tsx";
import { PlusIcon } from "../components/Icons.tsx";
import { Shell } from "../components/Shell.tsx";
import { BoardSkeleton } from "../components/Skeleton.tsx";
import { Summary } from "../components/Summary.tsx";
import { boardSignature, copyText, downloadBoard, serializeBoard } from "../lib/board.ts";
import { loadPublished, readBoardFile } from "../lib/load.ts";
import { btnPrimary, btnSecondary, cx, fieldClass } from "../lib/styles.ts";
import { clearDraft, readDraft, saveDraft } from "../lib/storage.ts";
import type { Application, BoardFile } from "../types.ts";

export function ManagePage() {
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";
  const [now] = useState(() => new Date());
  const [published, setPublished] = useState<BoardFile | null>(null);
  const [board, setBoard] = useState<BoardFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Application | null | undefined>(undefined);

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

  const commit = (next: BoardFile) => {
    setBoard(next);
    if (published && boardSignature(next) === boardSignature(published)) clearDraft();
    else saveDraft(next);
  };

  const saveApplication = (application: Application) => {
    if (!board) return;
    const exists = board.applications.some((item) => item.id === application.id);
    const applications = exists
      ? board.applications.map((item) => (item.id === application.id ? application : item))
      : [application, ...board.applications];
    commit({ ...board, applications });
    setEditing(undefined);
    setNotice("Saved in this browser. Export JSON to update the shared board.");
  };

  const deleteApplication = (id: string) => {
    if (!board) return;
    commit({ ...board, applications: board.applications.filter((item) => item.id !== id) });
    setEditing(undefined);
    setNotice("Deleted in this browser. Export JSON to update the shared board.");
  };

  const exportJson = () => {
    if (!board || !board.owner.trim()) {
      setNotice("Add a name before exporting.");
      return;
    }
    downloadBoard(board);
    setNotice("Downloaded applications.json. Replace public/data/applications.json, then redeploy.");
  };

  const copyJson = async () => {
    if (!board || !board.owner.trim()) {
      setNotice("Add a name before copying.");
      return;
    }
    try {
      await copyText(serializeBoard(board));
      setNotice("Copied applications.json. Paste it over public/data/applications.json, then redeploy.");
    } catch {
      setNotice("Couldn't copy. Use Export JSON instead.");
    }
  };

  const importJson = async (file: File | undefined) => {
    if (!file || !board) return;
    try {
      const next = await readBoardFile(file);
      commit(next);
      setNotice(`Imported ${next.applications.length} applications into this browser. Export JSON to publish them.`);
    } catch (err: unknown) {
      setNotice(err instanceof Error ? err.message : "Couldn't import that file.");
    }
  };

  const discard = () => {
    if (!published) return;
    clearDraft();
    setBoard(published);
    setNotice("Restored the shared board.");
  };

  return (
    <Shell
      title="Manage"
      subtitle="Edits stay in this browser until you export."
      embed={embed}
      actions={
        <>
          <Link to="/" className={`${btnSecondary} no-print`}>
            View shared board
          </Link>
          <button type="button" className={`${btnPrimary} no-print`} onClick={() => setEditing(null)} disabled={!board}>
            <PlusIcon className="h-4 w-4" />
            Add application
          </button>
        </>
      }
      footer={<p>Export applications.json into public/data, then redeploy, to update what visitors see.</p>}
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
                    {dirty ? "Local draft" : "Matches shared board"}
                  </span>
                </div>
                <p className="mt-1.5 text-sm leading-5 text-muted">
                  Visitors read <span className="font-medium text-ink">public/data/applications.json</span>. This page
                  does not change the shared board until you export that file and redeploy.
                </p>
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
                <button type="button" className={btnSecondary} onClick={discard} disabled={!dirty || !published}>
                  Discard local edits
                </button>
              </div>
            </div>
            <label className="mt-4 flex max-w-md flex-col gap-1.5 text-xs font-semibold text-muted">
              Name on the board
              <input
                value={board.owner}
                maxLength={80}
                onChange={(event) => commit({ ...board, owner: event.target.value })}
                className={fieldClass}
              />
            </label>
          </section>
          <Summary applications={board.applications} now={now} />
          <BoardList
            applications={board.applications}
            now={now}
            showNotes
            onEdit={(application) => setEditing(application)}
            onDelete={(application) => deleteApplication(application.id)}
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
    </Shell>
  );
}
