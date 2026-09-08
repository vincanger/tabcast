# Article to Podcast

A Wasp showcase app in two parts: a Chrome extension that saves articles with one click, and a Wasp web app that turns your unread saves into a narrated podcast episode on demand.

## Goals

- Demonstrate Wasp as the backend for a browser extension: auth, operations, custom HTTP APIs, background jobs, and S3 storage in one small codebase.
- Be readable as a showcase. Prefer fewer moving parts over completeness.

## Decisions

| Area | Decision |
| --- | --- |
| Audience | Wasp showcase and demo app |
| Storage | Wasp backend with user accounts, Postgres |
| Podcast format | Single narrator summary |
| Trigger | Manual Generate button with a target length slider |
| Article parsing | In the extension via Mozilla Readability on the live DOM |
| AI providers | OpenAI for both script and text to speech |
| Playback | Web app dashboard only |
| Extension auth | Email and password via Wasp auth, session stored in extension storage |
| Episode scope | Every article not yet included in an episode |
| Audio storage | S3 compatible bucket |
| Extension tooling | WXT with React and TypeScript, Manifest V3 |
| Repo layout | Monorepo, `app/` for Wasp and `extension/` for WXT |
| Wasp base | Bare Wasp app, no Open SaaS |
| Save UX | One click on the toolbar icon, badge feedback, no popup on save |
| Duplicates | Same URL saved twice is a no-op, badge says already saved |
| Transcript | Episode page shows script and links to source articles |
| Wasp version | 0.25 |

## Out of scope for v1

Scheduled generation, two host format, RSS feed, playback inside the extension, Google OAuth, billing.

## Extension

Built with WXT, React, and TypeScript.

- **Toolbar click.** The background service worker handles `action.onClicked`. It asks the content script on the active tab to parse the page, then posts the result to the backend.
- **Parsing.** A content script registered on all URLs runs Readability on a clone of the document when asked. It returns title, text content, excerpt, site name, byline, and canonical URL. If the content script is not present on the tab, the background injects it and retries once.
- **Badge feedback.** Green check on saved, blue dot on already saved, red exclamation on error. The badge clears after a few seconds. If the user is logged out the badge shows a lock and the popup opens.
- **Popup.** Only for auth and status. Shows a login form when logged out. Shows the logged in email, a count of unused saves, a link to the dashboard, and a logout button when logged in.
- **Storage.** Session id, server URL, and dashboard URL live in `browser.storage.local`. Server URL defaults to localhost in development and is editable in the popup.
- **Requests.** Every backend call sends `Authorization: Bearer <sessionId>`. The API URL is listed in `host_permissions` so the service worker can call it.

## Backend

Bare Wasp 0.25 app, Postgres, email and password auth with verification skipped in development.

### Entities

- **User.** Wasp auth user.
- **Article.** `id`, `userId`, `url`, `title`, `siteName`, `byline`, `excerpt`, `textContent`, `wordCount`, `savedAt`, `episodeId` nullable. Unique on `userId` plus `url`.
- **Episode.** `id`, `userId`, `status` (pending, generating, ready, failed), `targetMinutes`, `title`, `script` nullable, `audioKey` nullable, `durationSeconds` nullable, `error` nullable, `createdAt`, `completedAt` nullable.

### Operations

- `getInbox` query. Unused articles for the current user, newest first.
- `getEpisodes` query. Episodes for the current user, newest first, with source article titles.
- `getEpisode` query. One episode with script, a short lived signed audio URL, and its articles.
- `deleteArticle` action. Deletes an unused article owned by the user.
- `generateEpisode` action. Takes `targetMinutes`. Fails if there are no unused articles or an episode is already pending. Creates the episode, links the unused articles to it, and submits the generation job.

### Custom HTTP APIs for the extension

- `POST /api/ext/articles`. Body is the parsed article. Returns `created` or `duplicate` with the article id. Requires auth.
- `GET /api/ext/status`. Returns the user email and unused article count. Requires auth. The popup uses this to check whether the stored session is still valid.
- Login and logout use Wasp's built in email auth endpoints.

An `apiNamespace` on `/api/ext` configures CORS so the extension origin is allowed.

### Generation job

`generateEpisodeJob` runs on PgBoss.

1. Mark the episode as generating.
2. Load its articles. Truncate each article to a per article character budget so a long backlog does not blow the context window.
3. Ask OpenAI for a script. The prompt states the target length in words, roughly 150 words per minute, and asks for a single narrator digest with a short intro, one segment per article, and a sign off. It also asks for an episode title.
4. Split the script into chunks under the OpenAI text to speech input limit, request MP3 for each, and concatenate the buffers.
5. Upload the MP3 to S3 under `episodes/<userId>/<episodeId>.mp3`.
6. Mark the episode ready with the title, script, audio key, and estimated duration. On any error, mark it failed with the message and unlink the articles so they return to the inbox.

### Environment

Server: `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_SCRIPT_MODEL` (default gpt-4o-mini), `OPENAI_TTS_MODEL` (default tts-1), `OPENAI_TTS_VOICE` (default alloy), `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` optional for S3 compatible providers. Validated with a Zod schema.

## Dashboard

Wasp React client. All pages require auth.

- **Inbox** at `/`. List of unused saves with title, site, word count, and delete. A slider from 2 to 15 minutes, default 5. A Generate button disabled when the inbox is empty or an episode is pending. Shows the pending episode status inline and polls until it settles.
- **Episodes** at `/episodes`. List with title, date, status, and article count.
- **Episode** at `/episodes/:id`. Audio player, script, and a list of source articles linking to the original URLs.
- **Auth** pages at `/login` and `/signup`, plus the verification and password reset routes Wasp requires.

## Repo layout

```
app/          Wasp app
extension/    WXT extension
SPEC.md       This document
CLAUDE.md     Working notes for agents
```

## Running locally

1. `cd app && wasp start db` in one terminal.
2. Copy `app/.env.server.example` to `app/.env.server` and fill in OpenAI and S3 values.
3. `cd app && wasp db migrate-dev && wasp start`.
4. `cd extension && npm run dev`, then load `extension/.output/chrome-mv3` as an unpacked extension.
5. Sign up in the web app, log in from the extension popup, click the icon on an article.
