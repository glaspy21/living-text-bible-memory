"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { WizardSteps } from "@/client/components/admin/wizard-steps";
import {
  UploadError,
  analyzeAudio,
  checkChosenFile,
  uploadAudio,
  type AudioAnalysis,
} from "@/client/admin/upload-client";
import { cn } from "@/client/lib/cn";
import { formatTime } from "@/shared/audio/format-time";
import {
  checkRecordingInput,
  type GenreChoice,
  type RecordingInput,
} from "@/shared/library/recording-input";
import { DEFAULT_GENRES } from "@/shared/music/genres";
import { BOOKS } from "@/shared/scripture/books";
import { titleCase } from "@/shared/text/title-case";

const field = "flex flex-col gap-[5px] text-xs text-muted";
const input =
  "w-full min-w-0 rounded-lg border border-line bg-[#0d0d0d] px-3 py-2 text-[14px] text-text outline-none focus:border-gold";
const CUSTOM = "__custom__";

type Uploaded = { key: string; name: string; bytes: number; analysis: AudioAnalysis | null };

function megabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(bytes > 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

/**
 * Upload → Metadata. Choose an MP3 or WAV (it goes straight to storage and is verified), then say
 * what it sings. Saving creates a draft recording and takes you to the verse-timing step.
 * A matching passage never replaces an existing recording.
 */
export function UploadWizard() {
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploaded, setUploaded] = useState<Uploaded | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Metadata
  const [translation, setTranslation] = useState<"WEB" | "ESV">("WEB");
  const [genre, setGenre] = useState<string>(DEFAULT_GENRES[0].slug);
  const [customGenre, setCustomGenre] = useState("");
  const [book, setBook] = useState("john");
  const [chapter, setChapter] = useState("1");
  const [verseStart, setVerseStart] = useState("1");
  const [verseEnd, setVerseEnd] = useState("1");
  const [laterChapter, setLaterChapter] = useState(false);
  const [endChapter, setEndChapter] = useState("");
  const [description, setDescription] = useState("");
  const [counts, setCounts] = useState<number[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function loadCounts(slug: string) {
    try {
      const response = await fetch(`/api/scripture/verse-counts?book=${encodeURIComponent(slug)}`);
      setCounts(response.ok ? (await response.json()).counts : []);
    } catch {
      setCounts([]);
    }
  }

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    const refusal = checkChosenFile(file);
    if (refusal) return setProblem(refusal);

    setProgress(0);
    try {
      // Upload and decode at the same time; the waveform is a bonus, the upload is what matters.
      const [sent, analysis] = await Promise.all([
        uploadAudio(file, setProgress),
        analyzeAudio(file),
      ]);
      setUploaded({ key: sent.key, name: file.name, bytes: file.size, analysis });
      void loadCounts(book);
    } catch (error) {
      setProblem(
        error instanceof UploadError ? error.message : "Something went wrong while uploading.",
      );
    } finally {
      setProgress(null);
    }
  }

  const genreChoice: GenreChoice =
    genre === CUSTOM ? { kind: "custom", name: customGenre } : { kind: "builtin", slug: genre };

  function draft(): RecordingInput | null {
    if (!uploaded) return null;
    const chap = Number(chapter);
    return {
      key: uploaded.key,
      translation,
      book,
      chapter: chap,
      verseStart: Number(verseStart),
      endChapter: laterChapter ? Number(endChapter) : chap,
      verseEnd: Number(verseEnd),
      genre: genreChoice,
      description,
    };
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const value = draft();
    if (!value || !uploaded) return;
    const checked = checkRecordingInput(value, counts);
    if (!checked.ok) return setErrors(checked.errors);
    setErrors([]);
    setSaving(true);
    try {
      const response = await fetch("/api/admin/recordings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...checked.value, peaks: uploaded.analysis?.peaks }),
      });
      const body = await response.json();
      if (!response.ok) {
        setErrors(body.errors ?? ["The recording could not be saved."]);
        return;
      }
      router.push(`/admin/timing?recording=${body.id}`);
    } catch {
      setErrors(["The recording could not be saved. Check your connection and try again."]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div data-testid="upload-wizard">
      <WizardSteps current={uploaded ? 1 : 0} />

      {!uploaded && (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void choose(event.dataTransfer.files[0]);
          }}
          className={cn(
            "rounded-xl border border-dashed p-10 text-center text-muted",
            dragging
              ? "border-gold bg-[rgba(201,164,92,.09)]"
              : "border-line2 bg-[rgba(201,164,92,.03)]",
          )}
        >
          <b className="mb-1.5 block font-serif text-[22px] font-medium text-gold2">
            Drop an audio file
          </b>
          MP3 or WAV · up to 300 MB · chapter, passage or single verse
          <div className="mt-4">
            <input
              ref={picker}
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav"
              className="sr-only"
              aria-label="Audio file"
              onChange={(event) => void choose(event.target.files?.[0])}
            />
            <button
              type="button"
              disabled={progress !== null}
              onClick={() => picker.current?.click()}
              className="rounded-[7px] border border-gold bg-[rgba(201,164,92,.07)] px-5 py-[9px] text-gold2 disabled:opacity-50"
            >
              Choose file
            </button>
          </div>
          {progress !== null && (
            <div className="mx-auto mt-5 max-w-[360px]" role="status" aria-live="polite">
              <div className="h-1 rounded bg-[#2c2a26]">
                <i
                  className="block h-1 rounded bg-gradient-to-r from-[#e8cb8a] to-[#d4a84f] transition-[width]"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <span className="mt-1.5 block text-xs">Uploading… {Math.round(progress * 100)}%</span>
            </div>
          )}
          {problem && (
            <p className="mt-4 text-err" role="alert">
              {problem}
            </p>
          )}
        </div>
      )}

      {uploaded && (
        <form onSubmit={save} noValidate>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-line bg-[rgba(18,18,18,.7)] p-4">
            <div>
              <b className="block font-medium text-gold2" data-testid="uploaded-name">
                {uploaded.name}
              </b>
              <span className="text-xs text-muted">
                {megabytes(uploaded.bytes)}
                {uploaded.analysis
                  ? ` · ${formatTime(uploaded.analysis.durationSec * 1000)} · waveform ready`
                  : " · waveform will be made later"}
              </span>
            </div>
            <span className="rounded-full border border-ok px-2.5 py-0.5 text-[11.5px] text-ok">
              Uploaded
            </span>
          </div>

          <h2 className="mb-3 font-serif text-2xl font-medium text-heading">Metadata</h2>
          <div className="grid grid-cols-2 gap-x-[18px] gap-y-3.5">
            <label className={field}>
              Translation
              <select
                className={input}
                value={translation}
                onChange={(e) => setTranslation(e.target.value as "WEB" | "ESV")}
              >
                <option value="WEB">WEB</option>
                <option value="ESV">ESV</option>
              </select>
            </label>
            <label className={field}>
              Genre
              <select className={input} value={genre} onChange={(e) => setGenre(e.target.value)}>
                {DEFAULT_GENRES.map((g) => (
                  <option key={g.slug} value={g.slug}>
                    {g.name}
                  </option>
                ))}
                <option value={CUSTOM}>Custom</option>
              </select>
            </label>
            <label className={field}>
              Book
              <select
                className={input}
                value={book}
                onChange={(e) => {
                  setBook(e.target.value);
                  void loadCounts(e.target.value);
                }}
              >
                {BOOKS.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex min-w-0 gap-3">
              <label className={cn(field, "min-w-0 flex-1")}>
                Chapter
                <input
                  className={input}
                  inputMode="numeric"
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                />
              </label>
              <label className={cn(field, "min-w-0 flex-1")}>
                From verse
                <input
                  className={input}
                  inputMode="numeric"
                  value={verseStart}
                  onChange={(e) => setVerseStart(e.target.value)}
                />
              </label>
              <label className={cn(field, "min-w-0 flex-1")}>
                To verse
                <input
                  className={input}
                  inputMode="numeric"
                  value={verseEnd}
                  onChange={(e) => setVerseEnd(e.target.value)}
                />
              </label>
            </div>
            {genre === CUSTOM ? (
              <label className={field}>
                Custom genre name
                <input
                  className={input}
                  placeholder="e.g. Folk Acoustic"
                  value={customGenre}
                  onChange={(e) => setCustomGenre(titleCaseTyping(e.target.value))}
                />
              </label>
            ) : (
              <span />
            )}
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={laterChapter}
                  onChange={(e) => setLaterChapter(e.target.checked)}
                />
                Continues into a later chapter
              </label>
              {laterChapter && (
                <label className={cn(field, "flex-1")}>
                  Last chapter
                  <input
                    className={input}
                    inputMode="numeric"
                    value={endChapter}
                    onChange={(e) => setEndChapter(e.target.value)}
                  />
                </label>
              )}
            </div>
            <label className={cn(field, "col-span-2")}>
              Description (optional)
              <textarea
                className={input}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </div>

          <p className="mt-4 rounded-r-lg border-l-2 border-gold bg-[rgba(212,168,79,.07)] px-4 py-3 text-[13px] text-muted">
            Saved as a new version — matching passage references never overwrite an existing
            recording. Status: Draft.
          </p>

          {errors.length > 0 && (
            <ul className="mt-4 list-disc pl-5 text-err" role="alert">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          <div className="mt-5">
            <button
              type="submit"
              disabled={saving}
              className="rounded-[7px] border border-[#d8b872] bg-gradient-to-b from-[#e0c07a] to-[#a8843f] px-5 py-[9px] font-semibold text-[#120d03] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save draft & set verse timing →"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Title Case as the admin types, keeping a trailing space so words can be separated. */
function titleCaseTyping(value: string): string {
  const cased = titleCase(value);
  return /\s$/.test(value) && cased ? `${cased} ` : cased;
}
