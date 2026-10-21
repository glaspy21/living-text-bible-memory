"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import {
  analyzeAudio,
  checkChosenFile,
  uploadAudio,
  UploadError,
} from "@/client/admin/upload-client";
import { Button } from "@/client/components/ui/button";

/**
 * Replace a recording's audio: choose a file, upload it, and the server keeps the old audio and
 * starts a new timing draft from the old boundaries. Nothing a listener hears changes until the
 * new draft is published.
 */
export function ReplaceAudioButton({
  recordingId,
  published,
}: {
  recordingId: string;
  published: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function replace(file: File) {
    setError(null);
    const problem = checkChosenFile(file);
    if (problem) return setError(problem);
    const confirmed = window.confirm(
      published
        ? "Replace the audio? Listeners keep hearing the current audio until you publish the new timing."
        : "Replace the audio? The old file is kept, and your verse timing is copied to a new draft.",
    );
    if (!confirmed) return;
    try {
      setBusy("Uploading… 0%");
      const uploaded = await uploadAudio(file, (f) =>
        setBusy(`Uploading… ${Math.round(f * 100)}%`),
      );
      setBusy("Saving…");
      const analysis = await analyzeAudio(file);
      const response = await fetch(`/api/admin/recordings/${recordingId}/audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: uploaded.key, peaks: analysis?.peaks }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { errors?: string[] };
        throw new UploadError(body.errors?.[0] ?? "The audio could not be replaced.");
      }
      router.push(`/admin/timing?recording=${recordingId}`);
    } catch (e) {
      setError(e instanceof UploadError ? e.message : "The audio could not be replaced.");
      setBusy(null);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <input
        ref={input}
        id={inputId}
        type="file"
        accept=".mp3,.wav,audio/mpeg,audio/wav"
        className="sr-only"
        aria-label="Choose replacement audio"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void replace(file);
        }}
      />
      <Button
        size="sm"
        variant="ghost"
        disabled={busy !== null}
        onClick={() => input.current?.click()}
      >
        {busy ?? "Replace audio"}
      </Button>
      {error && (
        <span className="max-w-[220px] text-right text-xs text-err" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
