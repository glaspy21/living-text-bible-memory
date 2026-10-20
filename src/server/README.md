# Backend (`src/server`)

Code that only runs on the server and may touch secrets: database, auth, storage, Scripture providers.

- `db/` Prisma client (`db` from `db/client.ts`) and queries
- `auth/` admin allowlist and guards
- `storage/` storage interface, local and R2 drivers, upload checks, audio serving with Range support
- `scripture/` Scripture provider interface, WEB adapter (bundled text in `web-data/`), ESV adapter (flagged, John 1–2), cache
- `services/` business logic (publishing, recordings, uploads)

Start server-only files with `import "server-only";` so a client import fails the build.
May import from `src/shared`. **Must never import from `src/client`** (enforced by lint).
