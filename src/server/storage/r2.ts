import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ByteRange } from "@/shared/audio/byte-range";
import { UPLOAD_URL_TTL_SECONDS, isPeaksKey, isValidStorageKey } from "@/shared/audio/upload-rules";
import type { Playback, StorageDriver, UploadTarget } from "./types";

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

const READ_URL_TTL_SECONDS = 60 * 60;

/** Production storage: Cloudflare R2 (S3-compatible). The browser uploads and plays straight from it. */
export class R2StorageDriver implements StorageDriver {
  readonly name = "r2" as const;
  readonly playback: Playback;
  private readonly client: S3Client;

  constructor(private readonly config: R2Config) {
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // The SDK's newer default bakes a CRC32 checksum of an empty body into signed upload URLs,
      // which R2 then rejects for the real file. Only add checksums when a request requires one.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
    this.playback = {
      mode: "redirect",
      url: (key, mime) => {
        this.check(key);
        return getSignedUrl(
          this.client,
          new GetObjectCommand({ Bucket: config.bucket, Key: key, ResponseContentType: mime }),
          { expiresIn: READ_URL_TTL_SECONDS },
        );
      },
    };
  }

  private check(key: string) {
    if (!isValidStorageKey(key)) throw new Error("Invalid storage key");
  }

  async createUploadTarget(key: string, mime: string): Promise<UploadTarget> {
    this.check(key);
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ContentType: mime,
        // Never replace an existing original.
        IfNoneMatch: "*",
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );
    return { method: "PUT", url, headers: { "Content-Type": mime, "If-None-Match": "*" } };
  }

  async size(key: string): Promise<number | null> {
    this.check(key);
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      return head.ContentLength ?? null;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404) return null;
      throw error;
    }
  }

  async readBytes(key: string, range: ByteRange): Promise<Uint8Array> {
    this.check(key);
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Range: `bytes=${range.start}-${range.end}`,
      }),
    );
    return (await result.Body?.transformToByteArray()) ?? new Uint8Array();
  }

  async put(key: string, data: Uint8Array, mime: string): Promise<void> {
    if (!isPeaksKey(key)) throw new Error("Only waveform peaks can be stored this way");
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: data,
        ContentType: mime,
      }),
    );
  }

  async remove(key: string): Promise<void> {
    this.check(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }
}
