# Frontend (`src/client`)

Everything that runs in the browser: UI components, hooks, client state, the audio player UI.

- `components/ui/` design-system primitives (buttons, bars, icons)
- `components/listener/` Reader, Steps, Flashcards, player
- `components/admin/` upload, timing editor, library
- `hooks/` React hooks

May import from `src/shared`. **Must never import from `src/server`** (enforced by lint).
Talks to the backend only through route handlers in `src/app/api` or server actions.
