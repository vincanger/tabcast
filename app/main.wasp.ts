import { action, api, apiNamespace, app, job, page, query, route } from "@wasp.sh/spec";

import { serverEnvValidationSchema } from "./src/env" with { type: "ref" };
import { Root } from "./src/Root" with { type: "ref" };
import {
  LoginPage,
  SignupPage,
  EmailVerificationPage,
  RequestPasswordResetPage,
  PasswordResetPage,
} from "./src/auth/email/pages" with { type: "ref" };
import { onBeforeSignup } from "./src/auth/hooks" with { type: "ref" };
import { verificationEmail, passwordResetEmail } from "./src/auth/email/emails" with { type: "ref" };
import { InboxPage } from "./src/pages/InboxPage" with { type: "ref" };
import { EpisodesPage } from "./src/pages/EpisodesPage" with { type: "ref" };
import { EpisodePage } from "./src/pages/EpisodePage" with { type: "ref" };
import { SetupPage } from "./src/pages/SetupPage" with { type: "ref" };
import {
  deleteArticle,
  generateEpisode,
  getEpisode,
  getEpisodes,
  getFeed,
  getInbox,
  getSaveShortcut,
  getSchedule,
  rotateFeedToken,
  rotateSaveToken,
  updateSchedule,
} from "./src/operations" with { type: "ref" };
import { feedApi, feedAudioApi, feedChaptersApi } from "./src/feed" with { type: "ref" };
import { extApiMiddleware, extStatusApi, saveArticleApi, shortcutSaveApi } from "./src/apis" with { type: "ref" };
import { generateEpisodeJob } from "./src/jobs/generateEpisode" with { type: "ref" };
import { autoGenerateJob } from "./src/jobs/autoGenerate" with { type: "ref" };

export default app({
  name: 'articleToPodcast',
  wasp: { version: '^0.25.0' },
  title: 'Tabcast',
  head: ["<link rel='icon' href='/favicon.ico' />"],
  // TODO (AGENT): add og image and head stuff and plausible analytic and social media stuff
  // Verification and password reset emails go out through Resend from the
  // address below. Needs RESEND_API_KEY in .env.server and the domain
  // verified in Resend. See EMAILER_PLAN.md.
  emailSender: {
    provider: 'Resend',
    defaultFrom: { name: 'Tabcast', email: 'info@tabcast.xyz' },
  },
  auth: {
    userEntity: 'User',
    methods: {
      // Self-hosting and do not want an email provider? Comment out `email`,
      // uncomment `usernameAndPassword`, drop the `emailSender` block above,
      // the three email routes below and their imports, delete src/auth/email/
      // (Wasp only generates the email auth functions while that method is on),
      // and route the pages from src/auth/username/pages.tsx. There is no
      // password reset in that mode; fix one with `wasp db studio`. The
      // extension then logs in against /auth/username/login, see
      // extension/utils/api.ts.
      // usernameAndPassword: {},
      email: {
        fromField: { name: 'Tabcast', email: 'info@tabcast.xyz' },
        emailVerification: {
          clientRoute: 'EmailVerificationRoute',
          getEmailContentFn: verificationEmail,
        },
        passwordReset: {
          clientRoute: 'PasswordResetRoute',
          getEmailContentFn: passwordResetEmail,
        },
      },
    },
    onBeforeSignup,
    onAuthFailedRedirectTo: '/login',
    onAuthSucceededRedirectTo: '/',
  },
  client: { rootComponent: Root },
  server: { envValidationSchema: serverEnvValidationSchema },
  spec: [
    // Dashboard
    route('InboxRoute', '/', page(InboxPage, { authRequired: true })),
    route('EpisodesRoute', '/episodes', page(EpisodesPage, { authRequired: true })),
    route('EpisodeRoute', '/episodes/:id', page(EpisodePage, { authRequired: true })),
    route('SetupRoute', '/setup', page(SetupPage, { authRequired: true })),

    // Auth
    route('LoginRoute', '/login', page(LoginPage)),
    route('SignupRoute', '/signup', page(SignupPage)),
    route('EmailVerificationRoute', '/email-verification', page(EmailVerificationPage)),
    route('RequestPasswordResetRoute', '/request-password-reset', page(RequestPasswordResetPage)),
    route('PasswordResetRoute', '/password-reset', page(PasswordResetPage)),

    // Operations used by the dashboard
    query(getInbox, { entities: ['Article'] }),
    query(getEpisodes, { entities: ['Episode'] }),
    query(getEpisode, { entities: ['Episode'] }),
    action(deleteArticle, { entities: ['Article'] }),
    action(generateEpisode, { entities: ['Article', 'Episode'] }),
    query(getSchedule, { entities: ['GenerationSchedule'] }),
    action(updateSchedule, { entities: ['GenerationSchedule'] }),
    query(getFeed, { entities: ['User'] }),
    action(rotateFeedToken, { entities: ['User'] }),
    query(getSaveShortcut, { entities: ['User'] }),
    action(rotateSaveToken, { entities: ['User'] }),

    // HTTP APIs used by the Chrome extension
    apiNamespace('/api/ext', { middlewareConfigFn: extApiMiddleware }),
    api('POST', '/api/ext/articles', saveArticleApi, { entities: ['Article'], auth: true }),
    api('GET', '/api/ext/status', extStatusApi, { entities: ['Article'], auth: true }),

    // Saving from a phone. The iOS Shortcut parses the page with Safari Reader
    // and posts the same body as the extension, with a secret token in the
    // URL in place of a session.
    api('POST', '/api/save/:token', shortcutSaveApi, {
      entities: ['User', 'Article'],
      auth: false,
    }),

    // Podcast feed. Fetched by podcast apps, which cannot log in, so the user's
    // secret token in the URL stands in for a session.
    api('GET', '/api/feed/:token', feedApi, {
      entities: ['User', 'Episode', 'Article'],
      auth: false,
    }),
    api('GET', '/api/feed/:token/episodes/:id/audio.mp3', feedAudioApi, {
      entities: ['User', 'Episode'],
      auth: false,
    }),
    api('GET', '/api/feed/:token/episodes/:id/chapters.json', feedChaptersApi, {
      entities: ['User', 'Episode', 'Article'],
      auth: false,
    }),

    // Background generation
    job(generateEpisodeJob, { executor: 'PgBoss', entities: ['Episode', 'Article'] }),
    // Automatic generation. Ticks on the hour and half hour, UTC, which is
    // the grid users pick their time from.
    job(autoGenerateJob, {
      executor: 'PgBoss',
      entities: ['GenerationSchedule', 'Article', 'Episode'],
      schedule: { cron: '0,30 * * * *' },
    }),
  ],
});
