# Article to Podcast

Save articles from Chrome with one click. Generate a short narrated podcast that summarizes everything you saved since the last episode.

Built as a [Wasp](https://wasp.sh) showcase: a small full-stack app that serves as the backend for a browser extension. See [SPEC.md](SPEC.md) for the full design and every product decision.

## What's inside

```
app/                Wasp 0.25 app: auth, Postgres, operations, HTTP APIs, PgBoss job, S3 upload
extension/          WXT (Manifest V3) Chrome extension: Readability parsing, badge feedback, login popup
docker-compose.yml  Local S3 (MinIO) for development
```

**Flow.** Click the extension icon on any article. The content script runs Mozilla Readability on the page and posts the text to the Wasp backend. In the dashboard, pick a target length and click Generate. A background job asks OpenAI for a single narrator script, records it with OpenAI text to speech, uploads the MP3 to S3, and the episode page shows the player, the script, and links to the sources.

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

## Extension to backend contract

The extension never imports app code. It uses Wasp's built in auth endpoints and two custom APIs:

| Call | Purpose |
| --- | --- |
| `POST /auth/email/login` | Returns a session id, sent later as `Authorization: Bearer` |
| `POST /auth/logout` | Ends the session |
| `GET /api/ext/status` | Email and number of unused saves, used by the popup |
| `POST /api/ext/articles` | Saves a parsed article, returns `created` or `duplicate` |

## Deploying

The Wasp app deploys like any other Wasp app (`wasp deploy fly` or Railway). Set the server env vars from `.env.server.example` on the host, replacing the MinIO values with a real S3 compatible bucket: your own credentials, and `S3_ENDPOINT` either unset for AWS or pointed at your provider. Then open the extension popup, expand Server settings, and point it at your deployed API and client URLs.
