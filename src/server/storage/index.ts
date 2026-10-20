import "server-only";
import { LocalStorageDriver } from "./local";
import { R2StorageDriver } from "./r2";
import type { StorageDriver } from "./types";

/** The settings storage reads: STORAGE_DRIVER, LOCAL_STORAGE_DIR, AUTH_SECRET and the R2_* values. */
export type StorageEnv = Record<string, string | undefined>;

/** Build the driver named by STORAGE_DRIVER (default `local`). Fails loudly on missing settings. */
export function createStorage(env: StorageEnv = process.env): StorageDriver {
  const driver = env.STORAGE_DRIVER?.trim() || "local";

  if (driver === "local") {
    if (!env.AUTH_SECRET) throw new Error("AUTH_SECRET is required for local uploads");
    return new LocalStorageDriver(env.LOCAL_STORAGE_DIR || ".local-storage", env.AUTH_SECRET);
  }

  if (driver === "r2") {
    const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = env;
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
      throw new Error(
        "STORAGE_DRIVER=r2 needs R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET",
      );
    }
    return new R2StorageDriver({
      accountId: R2_ACCOUNT_ID,
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      bucket: R2_BUCKET,
    });
  }

  throw new Error(`Unknown STORAGE_DRIVER "${driver}" (use "local" or "r2")`);
}

let cached: StorageDriver | undefined;

/** The app's storage, created on first use. */
export function getStorage(): StorageDriver {
  return (cached ??= createStorage());
}
