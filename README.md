# Tabcast

Save articles from Chrome with one click. Generate a short narrated podcast that summarizes everything you saved since the last episode.

Built as a [Wasp](https://wasp.sh) showcase: a small full-stack app that serves as the backend for a browser extension. See [SPEC.md](SPEC.md) for the full design and every product decision.

## What's inside

```
app/                Wasp 0.25 app: auth, Postgres, operations, HTTP APIs, PgBoss jobs, S3 upload
                    Dashboard UI is Tailwind v4 + shadcn
extension/          WXT (Manifest V3) Chrome extension: Readability parsing, badge feedback, login popup
docker-compose.yml  Local S3 (MinIO) for development
```

**Flow.** Click the extension icon on any article, or share it from an iPhone to a Shortcut that reads the page with Safari Reader. The content script runs Mozilla Readability on the page and posts the text to the Wasp backend. In the dashboard, pick a target length and click Generate — or push the slider to its last stop to have the articles read aloud in full, capped at 90 minutes since text to speech is priced per character — or turn on a schedule that checks the inbox every day or week at a time you choose and generates only when enough is saved. A background job asks OpenAI for a single narrator script, records it with OpenAI text to speech, uploads the MP3 to S3, and the episode page shows the player, the script, and links to the sources.

## Get the extension

The extension isn't on the Chrome Web Store yet, so it loads as an unpacked extension.

1. Download the zip from the [latest release](https://github.com/vincanger/tabcast/releases/latest) and unzip it. Or build it yourself: `cd extension && npm install && npm run build` produces `extension/.output/chrome-mv3`.
2. Open `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked**, and pick the folder.
3. Pin the icon from the puzzle piece menu and click it once to open the popup.

Chrome reminds you about developer mode extensions on each launch until the Web Store listing is live; that's expected.

### Point it at a server

The popup's **Server settings** take an API server URL and a dashboard URL. Two options:

- **Use the hosted demo.** Sign up on the demo dashboard, then in Server settings click *use the hosted demo* (or enter the URLs by hand) and log in.
  <!-- TODO (AGENT): fill in the demo dashboard and API URLs here once deployed. They also go in extension/utils/api.ts and extension/.env.example. -->
- **Use your own deployment.** Enter the URLs of your deployed server and client. On Fly those are the two apps `wasp deploy fly launch <name>` creates: `https://<name>-server.fly.dev` and `https://<name>-client.fly.dev`. To ship a build with them pre-filled, see [Deploying](#deploying).

## Run it locally

You need Node 22+, Docker, the Wasp CLI, and an OpenAI API key. Audio storage runs locally, so no cloud bucket is required to try it.

```bash
npm i -g @wasp.sh/wasp-cli@latest
```

1. Start the dev database in one terminal:

   ```bash
   cd app && wasp start db
   ```

2. Start local S3:

   ```bash
   docker compose up -d
   ```

   This runs [MinIO](https://min.io), an object storage server that speaks the S3 API, and creates the `article-podcast` bucket. Episodes are stored on your machine and the app talks to it with the same client and presigned URLs it uses against a real bucket. Browse and play what it generates at http://localhost:9001 (`minioadmin` / `minioadmin`).

3. Configure the server. Copy `app/.env.server.example` to `app/.env.server` and add your OpenAI key. The S3 values already point at MinIO.

4. Migrate and start the app in a second terminal:

   ```bash
   cd app && wasp db migrate-dev && wasp start
   ```

   The dashboard is at http://localhost:3000 and the API at http://localhost:3001. Sign up there first.

5. Build the extension:

   ```bash
   cd extension && npm install && npm run build
   ```

   Open `chrome://extensions`, enable Developer mode, click Load unpacked, and pick `extension/.output/chrome-mv3`. For live reload use `npm run dev` instead.

6. Click the extension icon once to open the login popup and sign in with the account you created. From then on a click saves the current page. Right-click the icon for the dashboard and account settings.

## Listen in a podcast app

Open Episodes and click Enable podcast feed. The URL it gives you is a private RSS feed; paste it into any podcast app. In Apple Podcasts on a Mac choose File, then Add a Show by URL, and the show syncs to your iPhone through the same Apple ID. Anyone with the link can listen, so Regenerate it if it leaks.

## Extension to backend contract

The extension never imports app code. It uses Wasp's built in auth endpoints and two custom APIs:

| Call | Purpose |
| --- | --- |
| `POST /auth/username/login` | Returns a session id, sent later as `Authorization: Bearer` |
| `POST /auth/logout` | Ends the session |
| `GET /api/ext/status` | Username and number of unused saves, used by the popup |
| `POST /api/ext/articles` | Saves a parsed article, returns `created` or `duplicate` |
| `POST /api/save/:token` | Same body from the iOS Shortcut, authenticated by a per user token instead of a session |

## Deploying

The Wasp app deploys like any other Wasp app (`wasp deploy fly` or Railway). Set the server env vars from `.env.server.example` on the host, replacing the MinIO values with a real S3 compatible bucket: your own credentials, and `S3_ENDPOINT` either unset for AWS or pointed at your provider. Auth is username and password, so there is no email provider to configure. Set `SIGNUPS_OPEN=false` once you have created your account if the instance is just for you: the signup page stays, but the server refuses every new account, including ones attempted with curl against `/auth/username/signup`.

For the extension, copy `extension/.env.example` to `extension/.env`, set `WXT_SERVER_URL` and `WXT_DASHBOARD_URL` to your deployed URLs, and rebuild — the build then points at your instance out of the box. You can also leave the build alone and override both URLs under "Server settings" in the popup.
