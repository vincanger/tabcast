import { action, api, apiNamespace, app, job, page, query, route } from "@wasp.sh/spec";

import { serverEnvValidationSchema } from "./src/env" with { type: "ref" };
import { Root } from "./src/Root" with { type: "ref" };
import { LoginPage, SignupPage } from "./src/auth/pages" with { type: "ref" };
import { InboxPage } from "./src/pages/InboxPage" with { type: "ref" };
import { EpisodesPage } from "./src/pages/EpisodesPage" with { type: "ref" };
import { EpisodePage } from "./src/pages/EpisodePage" with { type: "ref" };
import {
  deleteArticle,
  generateEpisode,
  getEpisode,
  getEpisodes,
  getFeed,
  getInbox,
  rotateFeedToken,
} from "./src/operations" with { type: "ref" };
import { feedApi, feedAudioApi, feedChaptersApi } from "./src/feed" with { type: "ref" };
import { extApiMiddleware, extStatusApi, saveArticleApi } from "./src/apis" with { type: "ref" };
import { generateEpisodeJob } from "./src/jobs/generateEpisode" with { type: "ref" };

export default app({
  name: "articleToPodcast",
  wasp: { version: "^0.25.0" },
  title: "Article to Podcast",
  head: ["<link rel='icon' href='/favicon.ico' />"],
  auth: {
    userEntity: "User",
    // Username and password so a self-hosted deploy needs no email provider.
    // There is no password reset; reset one with `wasp db studio` if you must.
    methods: { usernameAndPassword: {} },
    onAuthFailedRedirectTo: "/login",
    onAuthSucceededRedirectTo: "/",
  },
  client: { rootComponent: Root },
  server: { envValidationSchema: serverEnvValidationSchema },
  spec: [
    // Dashboard
    route("InboxRoute", "/", page(InboxPage, { authRequired: true })),
    route("EpisodesRoute", "/episodes", page(EpisodesPage, { authRequired: true })),
    route("EpisodeRoute", "/episodes/:id", page(EpisodePage, { authRequired: true })),

    // Auth
    route("LoginRoute", "/login", page(LoginPage)),
    route("SignupRoute", "/signup", page(SignupPage)),

    // Operations used by the dashboard
    query(getInbox, { entities: ["Article"] }),
    query(getEpisodes, { entities: ["Episode"] }),
    query(getEpisode, { entities: ["Episode"] }),
    action(deleteArticle, { entities: ["Article"] }),
    action(generateEpisode, { entities: ["Article", "Episode"] }),
    query(getFeed, { entities: ["User"] }),
    action(rotateFeedToken, { entities: ["User"] }),

    // HTTP APIs used by the Chrome extension
    apiNamespace("/api/ext", { middlewareConfigFn: extApiMiddleware }),
    api("POST", "/api/ext/articles", saveArticleApi, { entities: ["Article"], auth: true }),
    api("GET", "/api/ext/status", extStatusApi, { entities: ["Article"], auth: true }),

    // Podcast feed. Fetched by podcast apps, which cannot log in, so the user's
    // secret token in the URL stands in for a session.
    api("GET", "/api/feed/:token", feedApi, {
      entities: ["User", "Episode", "Article"],
      auth: false,
    }),
    api("GET", "/api/feed/:token/episodes/:id/audio.mp3", feedAudioApi, {
      entities: ["User", "Episode"],
      auth: false,
    }),
    api("GET", "/api/feed/:token/episodes/:id/chapters.json", feedChaptersApi, {
      entities: ["User", "Episode", "Article"],
      auth: false,
    }),

    // Background generation
    job(generateEpisodeJob, { executor: "PgBoss", entities: ["Episode", "Article"] }),
  ],
});
