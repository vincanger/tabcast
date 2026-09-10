# Article to Podcast

## Layout

- `app/` is the Wasp 0.25 app. It has its own `CLAUDE.md` with Wasp conventions. Run `wasp compile` inside `app/` to validate.
- `extension/` is the WXT Chrome extension. Run `npm run compile` inside `extension/` to type check and `npm run build` to produce `.output/chrome-mv3`.

## Conventions

- The extension never imports from `app/`. It talks to the backend over HTTP only, using Wasp's built in auth endpoints and the custom `/api/ext/*` APIs.
- Secrets live in `app/.env.server`. Never put API keys in the extension.
- Keep the showcase small. Prefer one obvious way over configurability.
