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
| Podcast format | Single narrator summary that quotes every article at least once |
| Trigger | Manual Generate button with a target length slider |
| Article parsing | In the extension via Mozilla Readability on the live DOM, with a metadata fallback chain for the author |
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
| Dashboard UI | Tailwind v4 and shadcn, Radix registry with the Luma preset. Paper look: one cream ground, ink text, hairline rules, zero radius, Newsreader serif for reading with Inter for controls and labels, oxblood red as the only accent |
| Podcast feed | Private RSS per user, guarded by a secret token in the URL that the user can regenerate. No public feed and no directory listing |

## Out of scope for v1

Scheduled generation, two host format, a public feed or Apple Podcasts directory listing, playback inside the extension, Google OAuth, billing.

## Extension

Built with WXT, React, and TypeScript.

- **Toolbar click.** The background service worker handles `action.onClicked`. It asks the content script on the active tab to parse the page, then posts the result to the backend.
- **Parsing.** A content script registered on all URLs runs Readability on a clone of the document when asked. It returns title, text content, excerpt, site name, byline, and canonical URL. Readability only recognises a few byline patterns and misses Substack, X, and most newsletter templates, so the author falls back through JSON-LD `author`, `meta[name=author]`, `article:author`, `rel=author`, the `itemprop` microdata, and `twitter:creator`, taking the first usable value and rejecting bare URLs. If the content script is not present on the tab, the background injects it and retries once.
- **Badge feedback.** Green check on saved, blue dot on already saved, red exclamation on error. The badge clears after a few seconds. If the user is logged out the badge shows a lock and the popup opens.
- **Popup.** Only for auth and status. Shows a login form when logged out. Shows the logged in email, a count of unused saves, a link to the dashboard, and a logout button when logged in.
- **Storage.** Session id, server URL, and dashboard URL live in `browser.storage.local`. Server URL defaults to localhost in development and is editable in the popup.
- **Requests.** Every backend call sends `Authorization: Bearer <sessionId>`. The API URL is listed in `host_permissions` so the service worker can call it.

## Backend

Bare Wasp 0.25 app, Postgres, email and password auth with verification skipped in development.

### Entities

- **User.** Wasp auth user, plus `feedToken` nullable and unique. Set when the user enables the podcast feed, replaced on regenerate.
- **Article.** `id`, `userId`, `url`, `title`, `siteName`, `byline`, `excerpt`, `textContent`, `wordCount`, `savedAt`, `episodeId` nullable. Unique on `userId` plus `url`.
- **Episode.** `id`, `userId`, `status` (pending, generating, ready, failed), `phase` nullable (reading, writing, recording, set only while generating), `targetMinutes`, `title`, `script` nullable, `audioKey` nullable, `durationSeconds` nullable, `audioBytes` nullable, `error` nullable, `createdAt`, `completedAt` nullable.

### Operations

- `getInbox` query. Unused articles for the current user, newest first.
- `getEpisodes` query. Episodes for the current user, newest first, with source article titles.
- `getEpisode` query. One episode with script, a short lived signed audio URL, and its articles.
- `deleteArticle` action. Deletes an unused article owned by the user.
- `getFeed` query. The current user's feed URL, or null before they enable it.
- `rotateFeedToken` action. Creates the feed token on first use and replaces it afterwards, returning the new URL. Regenerating disconnects every subscriber.
- `generateEpisode` action. Takes `targetMinutes`. Fails if there are no unused articles or an episode is already pending. Creates the episode, links the unused articles to it, and submits the generation job.

### Custom HTTP APIs for the extension

- `POST /api/ext/articles`. Body is the parsed article. Returns `created` or `duplicate` with the article id. Requires auth.
- `GET /api/ext/status`. Returns the user email and unused article count. Requires auth. The popup uses this to check whether the stored session is still valid.
- Login and logout use Wasp's built in email auth endpoints.

An `apiNamespace` on `/api/ext` configures CORS so the extension origin is allowed.

### Podcast feed

Podcast apps cannot log in, so two unauthenticated routes accept the user's feed token instead.

- `GET /api/feed/:token`. RSS 2.0 with the iTunes namespace, listing the user's ready episodes newest first. Each item carries the title, publish date, a description with the source articles, the duration, and an enclosure pointing at the audio route below. Channel artwork is `public/podcast-artwork.png`, a 1400 by 1400 PNG served by the client. Unknown tokens get 404.
- `GET /api/feed/:token/episodes/:id/audio.mp3`. Checks the episode belongs to the token's user and is ready, then 302 redirects to a short lived signed S3 URL. The bucket stays private and S3 keeps serving range requests.

The feed is personal by design. The episodes narrate other people's articles with direct quotes, so there is no publish step and nothing that would make a feed public.

### Generation job

`generateEpisodeJob` runs on PgBoss.

1. Mark the episode as generating with phase `reading`.
2. Load its articles. Truncate each article to a per article character budget so a long backlog does not blow the context window.
3. Set phase `writing` and ask OpenAI for a script. The prompt states the target length in words, roughly 150 words per minute, and asks for a single narrator digest with a short intro, one segment per article, and a sign off. It also asks for an episode title. Every segment must carry at least one direct quote copied verbatim from the article; longer targets ask for more quotes and longer ones rather than more padding. If the draft comes back under 85% of the target the job asks once for an expanded version, since models routinely undershoot a long target.
4. Set phase `recording`, then split the script into chunks under the OpenAI text to speech input limit, request MP3 for each, and concatenate the buffers.
5. Upload the MP3 to S3 under `episodes/<userId>/<episodeId>.mp3`.
6. Mark the episode ready with the title, script, audio key, byte size, and duration, clearing the phase. The duration is measured by summing the MPEG frame headers of the finished MP3 rather than estimated from the word count, which matters because the file is a concatenation of several text to speech responses. On any error, mark it failed with the message, clear the phase, and unlink the articles so they return to the inbox.

### Environment

Server: `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_SCRIPT_MODEL` (default gpt-4o-mini), `OPENAI_TTS_MODEL` (default tts-1), `OPENAI_TTS_VOICE` (default alloy), `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` optional for S3 compatible providers. Validated with a Zod schema.

## Dashboard

Wasp React client. All pages require auth.

- **Inbox** at `/`. List of unused saves with title, site, word count, and delete. A slider from 2 to 15 minutes, default 5. A Generate button disabled when the inbox is empty or an episode is pending. Shows the generation steps inline, driven by the episode phase, and polls until it settles.
- **Episodes** at `/episodes`. List with title, date, status, and article count, and a podcast feed card that enables the feed, shows the URL with copy and regenerate, and explains how to add it to Apple Podcasts.
- **Episode** at `/episodes/:id`. Audio player, script, and a list of source articles linking to the original URLs. Cover art on this page and in the list is a mosaic of the source sites' favicons over a gradient seeded from the title, so nothing is stored or generated.
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
