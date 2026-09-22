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
<!-- TODO (AGENT): add a link to the Chrome Web Store listing once it is live. -->
2. Open `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked**, and pick the folder.
3. Pin the icon from the puzzle piece menu and click it once to open the popup.

Chrome reminds you about developer mode extensions on each launch until the Web Store listing is live; that's expected.

### Point it at a server

Out of the box the extension talks to the hosted demo. Sign up at [https://tabcast.xyz](https://tabcast.xyz) and log in from the popup. The popup's **Server settings** take an API server URL and a dashboard URL if you want something else:

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
| `POST /auth/email/login` | Returns a session id, sent later as `Authorization: Bearer` |
| `POST /auth/logout` | Ends the session |
| `GET /api/ext/status` | Account email and number of unused saves, used by the popup |
| `POST /api/ext/articles` | Saves a parsed article, returns `created` or `duplicate` |
| `POST /api/save/:token` | Same body from the iOS Shortcut, authenticated by a per user token instead of a session |

## Deploying

### Try the demo

The hosted demo at [https://tabcast.xyz](https://tabcast.xyz) is this repo, deployed as is, with `EPISODES_PER_USER=3`. Sign up, save a few articles, and make three episodes. After that the inbox asks you to deploy your own, which is the point: the demo exists to show the app, and your own instance has no limit and runs on your own OpenAI key.

### Run your own

The Wasp app deploys like any other Wasp app. The demo runs on [Fly.io](https://fly.io) with a [Tigris](https://www.tigrisdata.com) bucket for audio, and that is the path with the fewest moving parts, since Fly creates the bucket and its credentials for you. From `app/`:

```bash
wasp deploy fly setup <name> <region> --org <org>   # creates <name>-server and <name>-client
fly storage create -a <name>-server -n <name>-audio  # Tigris bucket, prints the credentials once
wasp deploy fly create-db <region> --org <org>
wasp deploy fly deploy --org <org>
```

Between the second and last step, set the server secrets with `fly secrets set -a <name>-server`: the bucket's access key and secret as `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`, `S3_BUCKET=<name>-audio`, `S3_REGION=auto`, `S3_ENDPOINT=https://fly.storage.tigris.dev`, plus `OPENAI_API_KEY` and `RESEND_API_KEY`. Tigris also sets its own `AWS_*` secrets on the app, which this code ignores. Commit the `fly-server.toml` and `fly-client.toml` that setup writes; from then on `wasp deploy fly deploy` is the whole release. Any other host works too (Railway, or anything that runs a Node server and a static client): set the env vars from `.env.server.example`, replacing the MinIO values with a real S3 compatible bucket, and `S3_ENDPOINT` either unset for AWS or pointed at your provider.

For a custom domain, `fly certs create yourdomain.com -a <name>-client` prints the A and AAAA records to add, and the server needs `WASP_WEB_CLIENT_URL=https://yourdomain.com` so CORS and the email links use it. The link preview image URL in `main.wasp.ts` is absolute too, so change it with the domain. Auth is email and password, with verification and password reset sent through [Resend](https://resend.com): verify your domain there, put the key in `RESEND_API_KEY`, and change the two `info@mail.tabcast.xyz` addresses in `main.wasp.ts` to yours (Resend recommends a sending subdomain like `mail.`, but the root domain works too). Leave `EPISODES_PER_USER` unset or `0` for no cap. Set `SIGNUPS_OPEN=false` once you have created your account if the instance is just for you: the signup page stays, but the server refuses every new account, including ones attempted with curl against `/auth/email/signup`.

### Auth without an email provider

If your instance is just for you, an email provider is more setup than it is worth. In `main.wasp.ts`, comment out the `email` method and the `emailSender` block, uncomment `usernameAndPassword`, drop the three email routes and their imports, delete `app/src/auth/email/` (Wasp only generates the email auth functions while that method is on, so those files stop compiling), and route the two pages from `app/src/auth/username/pages.tsx` in place of the email ones. The comment on the auth block walks through it, and `wasp compile` tells you if anything was missed. In the extension, switch the login call in `utils/api.ts` to `/auth/username/login` with a `{ username, password }` body. There is no password reset in that mode; change one with `wasp db studio`.

For the extension, copy `extension/.env.example` to `extension/.env`, set `WXT_SERVER_URL` and `WXT_DASHBOARD_URL` to your deployed URLs, and rebuild — the build then points at your instance instead of the demo. You can also leave the build alone and override both URLs under "Server settings" in the popup.
