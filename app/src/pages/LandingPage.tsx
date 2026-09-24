import { Link, type Routes } from "wasp/client/router";
import { Play } from "lucide-react";
import { useAuth } from "wasp/client/auth";
import { PoweredBy } from "../components/PoweredBy";
import { SourceIcon } from "../components/SourceIcon";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";

// The public front page. The header and closing call to action share one
// 720px column; the hero spreads wider to fit the product mock beside the
// copy, and the reading sections sit in a 672px column. Everything is set on the app's own tokens with a
// 22px spacing step, so the page reads as the same paper as the dashboard.
const REPO_URL = "https://github.com/vincanger/tabcast";
const EXTENSION_URL = `${REPO_URL}/releases/latest`;
// A public episode on the demo, shared from its owner's episode page.
const SAMPLE_EPISODE_ID = 1;

const STEPS = [
  "Save articles in Chrome, or from any app on your iPhone.",
  "Pick a length. A 15 minute summary, or the full text read aloud.",
  "Listen in your podcast app. Every article is a chapter.",
];

const FEATURES: [string, string][] = [
  [
    "Save from anywhere",
    "One click in Chrome, or the share sheet on your iPhone. The article text comes through clean, without the ads.",
  ],
  [
    "Pick the length",
    "A 15 minute summary before the commute, or the full text read aloud, up to 90 minutes.",
  ],
  [
    "Subscribe to your own Podcast",
    "Subscribe in your favorite Podcast app. Set a schedule and new episodes arrive automatically from whatever you saved.",
  ],
  [
    "More than just audio",
    "Skip by chapter, read the script, and jump back to the source when something is worth a second look.",
  ],
];

export function LandingPage() {
  const { data: user } = useAuth();
  const demoTo = user ? "/inbox" : "/signup";

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-[1000px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-10 lg:px-6 py-5">
          <Link to="/" className="font-heading text-[22px] leading-none font-medium tracking-tight">
            Tabcast
          </Link>
          <nav aria-label="Account" className="flex items-center gap-x-5">
            <Link to={user ? "/inbox" : "/login"} className="kicker py-1 hover:text-foreground">
              {user ? "Inbox" : "Log in"}
            </Link>
            <Link
              to={demoTo}
              className="kicker inline-flex min-h-10 items-center border border-input px-4 py-2 text-foreground hover:border-foreground"
            >
              Try the demo
            </Link>
          </nav>
        </div>
      </header>
      <section aria-labelledby="hero-heading" className="mx-auto w-full max-w-[1100px] px-6 pt-[88px] pb-[66px] sm:px-10">
        <div className="grid items-center gap-[66px] min-[720px]:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="grid gap-[27px]">
            <p className="kicker">Read later, finally</p>
            <h1
              id="hero-heading"
              className="max-w-[16ch] font-heading text-[40px] leading-[1.05] font-medium tracking-[-0.025em] text-balance min-[720px]:text-[60px]"
            >
              Your read-later pile, as a podcast.
            </h1>
            <p className="max-w-[46ch] text-xl leading-[1.45] text-pretty">
              Save articles from Chrome or your iPhone. Tabcast turns them into narrated episodes, in
              the podcast app you already use.
            </p>
            <div className="mt-[11px] flex flex-wrap items-center gap-x-6 gap-y-3">
              <PrimaryButton to={demoTo}>Try the demo</PrimaryButton>
              <Link
                to="/listen/:id"
                params={{ id: SAMPLE_EPISODE_ID }}
                className="kicker py-2 text-foreground underline decoration-border underline-offset-4 hover:text-rubric"
              >
                Hear a sample episode
              </Link>
            </div>
            <p className="italic text-muted-foreground">
              Open source. Run it on your own server, or try the hosted demo.
            </p>
          </div>
          <ProductMock />
        </div>
      </section>

      <section aria-labelledby="how-heading" className="border-t">
        <div className="mx-auto w-full max-w-[672px] px-6 py-[55px]">
          <h2 id="how-heading" className="kicker">
            How it works
          </h2>
          <ol className="mt-[27px] grid gap-[33px] min-[720px]:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step} className="grid gap-1.5 text-[17px] leading-[1.4]">
                <span aria-hidden className="font-heading text-[28px] leading-none text-rubric tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="border-t">
        <div className="mx-auto w-full max-w-[672px] px-6 py-[55px]">
          <h2 id="features-heading" className="kicker">
            What you get
          </h2>
          <ul className="mt-[27px] divide-y">
            {FEATURES.map(([title, body]) => (
              <li
                key={title}
                className="grid gap-x-[33px] gap-y-1 py-[22px] first:pt-0 last:pb-0 min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
              >
                <h3 className="font-heading text-[22px] leading-[1.2] font-medium tracking-[-0.01em]">{title}</h3>
                <p className="max-w-[52ch] text-[17px] leading-[1.45] text-muted-foreground text-pretty">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="closing-heading" className="border-t">
        <div className="mx-auto w-full max-w-[720px] flex flex-col items-center gap-[22px] px-6 py-[55px]">
          <h2
            id="closing-heading"
            className="max-w-[22ch] font-heading text-[32px] leading-[1.1] font-medium tracking-[-0.02em] text-balance text-center"
          >
            Stop saving articles you will never read.
          </h2>
          <PrimaryButton href={demoTo}>Try it now</PrimaryButton>
        </div>
      </section>
 

      <PoweredBy />
    </div>
  );
}

// A route path with no params, so it can be passed straight to Link.
type StaticRoute = Extract<Routes, { params?: never }>["to"];

// The accent-filled button in the kicker style, as a router link or a plain
// anchor for external destinations.
function PrimaryButton({ to, href, children }: { to?: StaticRoute; href?: string; children: React.ReactNode }) {
  const className = "kicker h-auto min-h-10 bg-rubric px-5 py-2 text-center whitespace-normal text-background hover:bg-rubric/90";
  return (
    <Button size="lg" asChild className={className}>
      {to ? (
        <Link to={to}>{children}</Link>
      ) : (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      )}
    </Button>
  );
}

// A still of the inbox: the generate sentence, its button, three saved
// articles and a player strip. Built from the dashboard's own pieces so it
// keeps pace with the real thing, but inert, so it is hidden from assistive
// technology and described by the copy beside it instead.
const MOCK_ARTICLES = [
  { url: "https://cnevpost.com/", title: "Toyota plans China-made extended-range EVs in 2027", words: "481 words" },
  { url: "https://remotegoats.com/", title: "Finding the best city in Switzerland for remote workers", words: "3,288 words" },
  { url: "https://x.com/", title: "Matija Sosic on X: “My explainer did crazy well…”", words: "103 words" },
];
const BARS = 36;
const PLAYED = 11;

function ProductMock() {
  return (
    <div aria-hidden className="grid gap-[22px] rounded-[4px] border bg-secondary p-[27px] shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_rgb(0_0_0/0.08)]">
      <p className="font-heading text-[22px] leading-[1.35]">
        Make a <Word>15 minute</Word> <Word>summary</Word> from the 3 articles below.
      </p>
      <span className="kicker inline-flex w-fit items-center bg-rubric px-3 py-2 text-background">
        Generate from 3 articles
      </span>
      <ul className="divide-y border-y">
        {MOCK_ARTICLES.map((a) => (
          <li key={a.title} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 py-2">
            <SourceIcon url={a.url} className="size-6 rounded-sm" />
            <span className="truncate font-serif text-[17px]">{a.title}</span>
            <span className="kicker whitespace-nowrap">{a.words}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
          <Play className="size-3 translate-x-px fill-current" />
        </span>
        <span className="flex h-5 flex-1 items-center gap-[2px]">
          {Array.from({ length: BARS }, (_, i) => (
            <span
              key={i}
              style={{ height: `${25 + Math.round(75 * Math.abs(Math.sin(i * 0.7)))}%` }}
              className={cn("flex-1", i < PLAYED ? "bg-rubric" : "bg-foreground/25")}
            />
          ))}
        </span>
        <span className="kicker tabular-nums">5:12</span>
      </div>
    </div>
  );
}

function Word({ children }: { children: React.ReactNode }) {
  return <span className="underline decoration-rubric decoration-1 underline-offset-[6px]">{children}</span>;
}
