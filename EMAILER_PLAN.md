# Emailer plan: send from `info@tabcast.xyz` via Resend

**Scope: send only.** The app sends verification and password reset emails
*from* `info@tabcast.xyz` through Resend. Nothing is set up to receive mail at
that address. Users who hit reply get a bounce or silence, so the email copy
should say "this inbox is not monitored" and point at the dashboard.

| Direction | Tool | Cost |
|---|---|---|
| App sends from `info@tabcast.xyz` | Resend verified domain + Wasp `emailSender: { provider: "Resend" }` | Free tier: 100/day, 3,000/month |
| Mail to `info@tabcast.xyz` | Not handled | |

Receiving was looked at and is possible later without changing anything here:
either the registrar's free email forwarding to Gmail (no code, MX on the root
domain, no clash with Resend's `send.` subdomain) or Resend Receiving (MX plus
an `email.received` webhook and the SDK's forward helper, counts against
quota). Skipped for now.

Sources checked: [Wasp email auth](https://wasp.sh/docs/auth/email.md),
[Wasp sending email](https://wasp.sh/docs/advanced/email.md),
[Resend: add a domain](https://resend.com/docs/add-a-domain.md),
[Resend: receiving on a custom domain](https://resend.com/docs/dashboard/receiving/custom-domains.md),
[Resend: forward received email](https://resend.com/docs/dashboard/receiving/forward-emails.md),
[Resend quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits.md).

---

## Part 1. Domain and DNS (after buying `tabcast.xyz`)

1. Resend dashboard → Domains → Add domain → `tabcast.xyz`, region closest to the Fly app.
2. Copy the generated records into the registrar's DNS. Values are per account, so
   take them from the Resend **Records** tab, not from here. There will be:
   - a DKIM `TXT` record (`resend._domainkey.tabcast.xyz`),
   - an SPF `TXT` and an `MX` record on the return-path subdomain (`send.tabcast.xyz` by default),
   - optionally a DMARC `TXT` on `_dmarc.tabcast.xyz` (start with `v=DMARC1; p=none;`).
3. Wait for "Verified". Usually under 15 minutes, worst case 72 hours.
4. Create an API key with **Sending access** only. Put it in `app/.env.server` as
   `RESEND_API_KEY` (the placeholder is already in `.env.server.example`).

Resend recommends sending from a subdomain for deliverability. The `From`
address the user asked for is on the root, and that is fine for transactional
volume this low: the return path is already on `send.tabcast.xyz`, which is
where bounce handling lives. If deliverability ever suffers, switch
`defaultFrom` to `info@mail.tabcast.xyz` and verify that subdomain instead. No
code change beyond the address.


---

## Part 2. Wasp: switch auth to email

The hosted demo uses email auth (verification and password reset through
Resend). `usernameAndPassword` stays in `main.wasp.ts` commented out, with a
note that self-hosters who do not want to set up an email provider can swap
the two blocks. The README gets the same note. The `SIGNUPS_OPEN` gate is
method agnostic and stays.

### 2a. `app/main.wasp.ts`

```ts
import {
  LoginPage,
  SignupPage,
  EmailVerificationPage,
  RequestPasswordResetPage,
  PasswordResetPage,
} from "./src/auth/pages" with { type: "ref" };

export default app({
  // ...
  emailSender: {
    provider: "Resend",
    defaultFrom: { name: "Tabcast", email: "info@tabcast.xyz" },
  },
  auth: {
    userEntity: "User",
    methods: {
      // Self-hosting and do not want an email provider? Comment out `email`,
      // uncomment `usernameAndPassword`, drop the three email routes below and
      // the `emailSender` block, and use the username forms in src/auth/pages.tsx.
      // There is no password reset in that mode; fix one with `wasp db studio`.
      // usernameAndPassword: {},
      email: {
        fromField: { name: "Tabcast", email: "info@tabcast.xyz" },
        emailVerification: { clientRoute: "EmailVerificationRoute" },
        passwordReset: { clientRoute: "PasswordResetRoute" },
      },
    },
    onBeforeSignup,
    onAuthFailedRedirectTo: "/login",
    onAuthSucceededRedirectTo: "/",
  },
  spec: [
    // ...existing routes
    route("EmailVerificationRoute", "/email-verification", page(EmailVerificationPage)),
    route("RequestPasswordResetRoute", "/request-password-reset", page(RequestPasswordResetPage)),
    route("PasswordResetRoute", "/password-reset", page(PasswordResetPage)),
  ],
});
```

Add `getEmailContentFn` refs under `emailVerification` and `passwordReset`
pointing at functions in `src/auth/emails.ts` that return `{ subject, text, html }`.
Besides the link, each email ends with one line: "Replies to this address are
not read." That is the only place the send-only decision shows.

### 2b. Auth pages

Wasp generates `wasp/client/auth` and `wasp/server/auth` for the active auth
method only, so email-only code cannot sit in `src/` on a username instance
(verified: it fails `wasp compile`). Layout:

- `app/src/auth/AuthForm.tsx`: the hand-rolled form pieces (they exist because
  Wasp's forms lack bound labels), with an `identity: "email" | "username"` prop.
- `app/src/auth/email/pages.tsx` and `emails.ts`: routed by default. Delete the
  folder when switching to username auth.
- `app/src/auth/username/pages.tsx`: casts `login`/`signup`, so it compiles in
  both modes.

- Email variant: `type="email"`, `autoComplete="email"`, label "Email".
- `LoginPage`: `login({ email, password })`.
- `SignupPage`: `signup({ email, password })`, then show "Check your inbox for a
  verification link" instead of auto-login. Email auth refuses login until the
  address is verified.
- Add "Forgot password?" link under the login form.
- New pages, same `Card` shell, using `wasp/client/auth`:
  - `EmailVerificationPage`: reads `?token=` from the URL, calls `verifyEmail({ token })`, links to `/login`.
  - `RequestPasswordResetPage`: one email field, `requestPasswordReset({ email })`, confirmation copy.
  - `PasswordResetPage`: new password field, `resetPassword({ token, password })`.

### 2c. Other references to the username identity

- `app/src/Root.tsx`: `user.identities.username?.id` → `user.identities.email?.id`.
- `app/src/apis.ts` `extStatusApi`: return `email` instead of `username`.
- `README.md`: in the Deploying section, a short "Auth without an email
  provider" note mirroring the comment in `main.wasp.ts`.

### 2d. Env

- `app/src/env.ts`: nothing. Wasp validates `RESEND_API_KEY` itself once the provider is set.
- `app/.env.server.example`: `RESEND_API_KEY` is already there. Add
  `SKIP_EMAIL_VERIFICATION_IN_DEV=true` so local signups work without a key. In
  development Wasp does not send unless `SEND_EMAILS_IN_DEVELOPMENT=true`.
- Fly: `fly secrets set RESEND_API_KEY=... -a <server app>`.

### 2e. Database

No migration: `wasp db migrate-dev` reports the schema already in sync, since
both methods use Wasp's own auth tables. Existing username accounts cannot
become email accounts, so on the dev database run `wasp db reset` (or delete
the rows in `wasp db studio`) and sign up again.

---

## Part 3. Extension

The extension logs in over HTTP, so it follows the auth method.

- `extension/utils/api.ts`: `login(email, password)` posts to
  `/auth/email/login` with body `{ email, password }`. Rename the stored
  `username` setting to `email`. Leave a comment that a username-auth instance
  uses `/auth/username/login` with `{ username, password }`, so a self-hoster
  changing one line in the app changes one line here.
- `extension/entrypoints/popup/App.tsx`: email field, `type="email"`.
- Status display: read `email` from `/api/ext/status`.
- Bump to `0.2.0`; both READMEs mention "email and password" where they say username.

---

## Part 4. Verify

1. `docker compose up -d`, `wasp start`, sign up with `SKIP_EMAIL_VERIFICATION_IN_DEV=true`, log in, save an article from the extension.
2. Unset the skip flag, set `SEND_EMAILS_IN_DEVELOPMENT=true` and the real key, sign up with a Gmail address. Confirm the verification email arrives *from* `Tabcast <info@tabcast.xyz>` and the link verifies.
3. Request a password reset; confirm the email and the reset flow.
4. Check the message in Gmail → "Show original": SPF pass, DKIM pass, DMARC pass.
5. Done: swapped to username auth with `src/auth/email/` removed, `wasp compile` clean, swapped back, clean again.
6. `wasp compile` and `npm run compile` in `extension/` both clean.

## Status

Parts 2 and 3 are implemented. Part 1 (buy the domain, verify it in Resend,
set `RESEND_API_KEY` on Fly) and the email steps of Part 4 are yours.
