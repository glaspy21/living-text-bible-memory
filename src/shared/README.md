# Shared (`src/shared`)

Pure, framework-free logic and types used by both frontend and backend. No React, no Node-only APIs, no secrets.

- `timing/` verse-timing validation and normalization
- `audio/` playback state machine and timing math
- `scripture/` verse and range types, reference parsing
- `schemas/` Zod schemas
- `text/` small text helpers

**Must not import from `src/client` or `src/server`** (enforced by lint). Tests live beside the code.
