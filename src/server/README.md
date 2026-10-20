# Backend (`src/server`)

Code that only runs on the server and may touch secrets: database, auth, storage, Scripture providers.

- `db/` Prisma client and queries
- `auth/` admin allowlist and guards
- `storage/` storage interface with local and R2 adapters
- `scripture/` Scripture provider interface, WEB and ESV adapters, cache
- `services/` business logic (publishing, recordings, uploads)

Start server-only files with `import "server-only";` so a client import fails the build.
May import from `src/shared`. **Must never import from `src/client`** (enforced by lint).
