# Tabcast — Chrome extension

Saves the article you are reading to the Tabcast backend with one click on the toolbar icon.

Built with [WXT](https://wxt.dev), React, and TypeScript, Manifest V3. It never imports from `app/`; it talks to the backend over HTTP only.

## How it works

- **`entrypoints/background.ts`** — the service worker. Handles the toolbar click, asks the content script to parse the tab, posts the result to the backend, and shows badge feedback: green check saved, blue dot already saved, red exclamation error. While logged out the popup is attached to the icon so a click opens the login form instead.
- **`entrypoints/content.ts`** — registered on all URLs, does nothing until asked. On request it runs Mozilla Readability on a clone of the document and returns the title, text, excerpt, site name, byline, and canonical URL. Readability misses bylines on Substack, X, and most newsletters, so the author falls back through JSON-LD, `meta[name=author]`, `article:author`, `rel=author`, microdata, and `twitter:creator`.
- **`entrypoints/popup/`** — auth and status only. Login form when logged out; email, unused save count, dashboard link, and logout when logged in. "Server settings" overrides the API and dashboard URLs.
- **`utils/api.ts`** — every call sends `Authorization: Bearer <sessionId>`. A 401 clears the stored session so the next click shows login.

## Develop

```bash
npm install
npm run dev
```

Load `.output/chrome-mv3` at `chrome://extensions` with Developer mode on. `npm run dev` reloads on save.

A fresh install points at the hosted demo. To develop against a local backend (`cd app && wasp start`), copy `.env.example` to `.env` and use the localhost lines, or change the URLs under Server settings. Sign up in the web app first — the extension has no signup form of its own.

## Install without building

Grab the zip from the [latest release](https://github.com/vincanger/tabcast/releases/latest), unzip it, and load the folder at `chrome://extensions` with Developer mode on. Chrome reminds you about developer mode extensions on each launch until the Web Store listing is live; that's expected.

## Point it at a server

Out of the box the extension talks to the hosted demo at https://tabcast.xyz, so sign up there and log in. The popup's **Server settings** take an API server URL and a dashboard URL for anything else.

- **Your own deployment.** Enter your server and client URLs. On Fly those are the two apps `wasp deploy fly launch <name>` creates, `https://<name>-server.fly.dev` and `https://<name>-client.fly.dev`.

## Build for your own deployment

To bake your URLs into the build so a fresh install points at your instance instead of the demo, copy `.env.example` to `.env` and set them:

```
WXT_SERVER_URL=https://my-app-server.fly.dev
WXT_DASHBOARD_URL=https://my-app-client.fly.dev
```

Then `npm run build`, or `npm run zip` for a distributable archive. Both URLs stay editable under "Server settings" in the popup, so a build is never locked to one server.

`host_permissions` is `<all_urls>`, which covers any backend host as well as the pages Readability parses.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development build with live reload |
| `npm run build` | Production build into `.output/chrome-mv3` |
| `npm run zip` | Zips the build for distribution |
| `npm run compile` | Type check with `tsc --noEmit` |
