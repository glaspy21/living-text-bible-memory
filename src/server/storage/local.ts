import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, open, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { ByteRange } from "@/shared/audio/byte-range";
import { UPLOAD_URL_TTL_SECONDS, isPeaksKey, isValidStorageKey } from "@/shared/audio/upload-rules";
import type { Playback, StorageDriver, UploadTarget } from "./types";
import { signUploadToken, verifyUploadToken, type UploadGrant } from "./upload-token";

export const LOCAL_UPLOAD_PATH = "/api/admin/uploads/local";

/** Development storage: files in a folder on disk (git-ignored), uploaded through the app itself. */
export class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;
  readonly playback: Playback;

  constructor(
    private readonly root: string,
    private readonly secret: string,
  ) {
    this.root = path.resolve(root);
    this.playback = {
      mode: "stream",
      open: (key, range) => {
        const stream = createReadStream(this.pathFor(key), range);
        return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
      },
    };
  }

  private pathFor(key: string): string {
    if (!isValidStorageKey(key)) throw new Error("Invalid storage key");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async createUploadTarget(key: string, mime: string, bytes: number): Promise<UploadTarget> {
    this.pathFor(key);
    const token = signUploadToken({ key, mime, bytes }, this.secret, UPLOAD_URL_TTL_SECONDS);
    return {
      method: "PUT",
      url: `${LOCAL_UPLOAD_PATH}?token=${encodeURIComponent(token)}`,
      headers: { "Content-Type": mime },
    };
  }

  /** The permission inside an upload token, or null if it is forged or expired. */
  readGrant(token: string): UploadGrant | null {
    return verifyUploadToken(token, this.secret);
  }

  /**
   * Receive an upload. Writes to a temporary name and moves it into place only when exactly
   * `bytes` arrived, so a half-sent file is never served, and an existing file is never replaced.
   */
  async write(key: string, body: ReadableStream<Uint8Array>, bytes: number): Promise<void> {
    const target = this.pathFor(key);
    if ((await this.size(key)) !== null) throw new Error("A file already exists for this upload");
    await mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.part`;
    const file = await open(temp, "w");
    let received = 0;
    try {
      const reader = body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > bytes) throw new Error("More data than declared");
        await file.write(value);
      }
      if (received !== bytes) throw new Error("Less data than declared");
    } catch (error) {
      await file.close();
      await rm(temp, { force: true });
      throw error;
    }
    await file.close();
    await rename(temp, target);
  }

  async size(key: string): Promise<number | null> {
    try {
      return (await stat(this.pathFor(key))).size;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async readBytes(key: string, range: ByteRange): Promise<Uint8Array> {
    const file = await open(this.pathFor(key), "r");
    try {
      const buffer = Buffer.alloc(range.end - range.start + 1);
      const { bytesRead } = await file.read(buffer, 0, buffer.length, range.start);
      return new Uint8Array(buffer.subarray(0, bytesRead));
    } finally {
      await file.close();
    }
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    if (!isPeaksKey(key)) throw new Error("Only waveform peaks can be stored this way");
    const target = this.pathFor(key);
    await mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.part`;
    await writeFile(temp, data);
    await rename(temp, target);
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }
}
