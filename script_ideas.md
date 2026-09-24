# Tabcast launch video: script ideas

Reference: Wes Bos, "AI is getting cheap enough that you can process everything you see" (X, 54s).
https://x.com/wesbos/status/2102769412608778737

## The reference structure

The video is 54 seconds and about 135 spoken words, which is roughly 150 words a minute. It has eight beats:

| # | Time | Beat | What it does |
|---|------|------|--------------|
| 1 | 0–4s | **Result hook** | Opens on the payoff: he found a $500 item using the app he built. The result comes before any explanation. |
| 2 | 4–11s | **Verb chain** | Explains the product as four fast verbs: watches, identifies, looks up, tells me. That's the whole pipeline in one breath. |
| 3 | 11–18s | **Stack name-drop** | Names the stack: a custom agent, the model, eBay, web search and MCPs. It's short, and it tells developers "this is real" without turning into a tutorial. |
| 4 | 18–23s | **Open loop + thesis** | "I'll talk about the price in just a sec" plants a question he answers later. Then he states the thesis: it's cheap enough to process everything. |
| 5 | 23–33s | **Old way vs new way** | Contrasts rigid filters with telling it what you want in plain English. |
| 6 | 33–46s | **Field proof** | Real-world testing ("three thrift stores, a couple yard sales, hundreds of items") and a list of concrete, oddly specific finds. |
| 7 | 46–51s | **Close the loop** | Pays off the price question with one number (about a penny a frame) and one judgement ("a pretty good deal"). |
| 8 | 51–54s | **Bait + CTA** | A polarising question ("Is this cheating?") to drive replies, then points to the full build video. |

Why it works: the payoff comes first, each beat is one idea, the numbers are specific, the open loop keeps you watching to the end, and the closing question invites replies, which X rewards.

## Tabcast mapped onto those beats

- **Result:** I listened to everything I saved this week without reading any of it.
- **Verb chain:** one click saves the page → Readability strips it to text → the model writes one narrator script → text to speech records it → it lands in my podcast app.
- **Stack:** Chrome extension (WXT) talking to a Wasp backend: auth, Postgres, PgBoss background jobs, S3, OpenAI `gpt-4o-mini` for the script and `tts-1` for the voice.
- **Price (the open loop):** `tts-1` costs $15 per million characters. A 10 minute episode is about 1,500 words, or about 9,000 characters, so it costs **about 15 cents**. The script call barely registers. *Check this against a real episode in the OpenAI dashboard before recording.*
- **Old way vs new way:** read-later lists you never open, and tab graveyards, versus an inbox that turns itself into an episode.
- **Proof:** the actual article titles from a real week's episode; iPhone share-sheet saves; the scheduled episode that shows up at 7am.
- **Bait question:** "Does listening count as reading?"
- **CTA:** try it at tabcast.xyz, and it's open source and built with Wasp.

Every draft below aims for 50–60 seconds, about 130–150 words. Fill in the `[brackets]` from a real episode.

---

## Variation A: Straight port

Same eight beats in the same order, with the Tabcast content swapped in.

> I listened to every article I saved this week, and I didn't read a single one. It's an app I built. One click in Chrome saves the page, it pulls out the article text, writes a script, records it in a narrator's voice, and drops the episode into my podcast app. It's a Chrome extension talking to a Wasp backend: background jobs, S3, OpenAI for the script and the voice. I'll get to the price in a sec. Instead of a read-later list I never open, I just save stuff and forget about it. It tells me when there's enough for an episode. This week that was [14] articles: [a piece on X], [a long read on Y], [that one essay everyone shared]. [22] minutes, on my walk. Price-wise, a ten minute episode costs about fifteen cents. Does listening even count as reading? It's open source, link below.

**Pros**
- It copies a structure that has already worked, so it's the lowest-risk option.
- The price open loop fits well: people assume "AI podcast" means expensive.
- The stack beat reaches developers and plugs Wasp without turning into an ad.

**Cons**
- Beat 1 is weaker than Wes's. "I found a $500 item" is a money result you can see; "I listened to my articles" is a convenience result, and nobody gasps at it.
- On X, followers who've seen Wes's video may recognise the template.

---

## Variation B: Pain first

Open on the problem instead of the result, then use Wes's beats 2–8.

> I have [63] tabs open that I'm "going to read later." I never do. So I built this. One click saves the article, and every week it turns everything I saved into a short podcast, one narrator walking through all of it. [Show the tab bar collapsing into the Tabcast inbox.] Under the hood it's a Chrome extension, a Wasp app, a background job that writes the script with OpenAI and records it with text to speech. Stick around for the price. The tabs are gone. This morning's episode covered [a piece on X], [Y] and [Z], [18] minutes, and I heard it while making coffee. Each episode costs about fifteen cents. Be honest: how many tabs do you have open right now?

**Pros**
- Tab hoarding is a universal, slightly embarrassing pain, so viewers relate within a second.
- The closing question is easy to answer ("400"), which gets more replies than an opinion question.
- The before and after is strongly visual: a crowded tab bar becomes one episode.

**Cons**
- It opens on a problem rather than a payoff. That's a softer hook, and people scrolling have seen "I have too many tabs" plenty of times.
- It takes longer to reach the part that makes Tabcast different: the audio.

---

## Variation C: Builder angle (Wasp first)

It keeps Wes's pace, but the result being shown off is the build rather than the finds. It's aimed at developers.

> This Chrome extension turns the articles I save into a weekly podcast, and the whole backend is one Wasp app. Auth, Postgres, a background job queue, S3 uploads, a private RSS feed. The extension just calls it over HTTP. Here's the flow: click saves the page, Readability pulls the text, a PgBoss job asks OpenAI for a script, text to speech records it, the MP3 goes to S3, and the feed updates in my podcast app. No separate queue service, no auth provider, [N] lines of config. It even retries when a worker dies mid-episode. I'll tell you what an episode costs in a sec. [Play 3s of an episode.] That's this week's saves. About fifteen cents. Would you ship an extension backend like this, or roll your own? Repo's open source.

**Pros**
- It's the best fit for the actual goal, a Wasp showcase: every beat shows a Wasp feature doing real work.
- Its audience is the one most likely to star the repo and try Wasp.
- The claim "the whole backend is one Wasp app" is concrete and checkable.

**Cons**
- It reads as a framework ad. Non-developers scroll past, which limits reach.
- The product's magic, hearing your own reading list, comes late and briefly.
- It moves furthest from the reference, so you get less of the benefit of copying a proven structure.

---

## Variation D: Audio cold open

It starts on Wes's result-first beat in its most literal form: the product's output *is* audio, so the video opens on the audio.

> [Cold open: 4 seconds of a real episode, with the narrator mid-sentence on a real article, captions burned in, a podcast player on screen.] That's not a podcast. That's the [14] tabs I saved this week. I built this. One click in Chrome saves the page, it strips the article out, writes one script for all of them, records it, and drops it in my podcast app, every Sunday at 7am. Chrome extension, Wasp backend, OpenAI for the script and the voice. I'll get to the price. No more read-later list I never open. I just save things. This week: [a piece on X], [Y], and [a 6,000 word essay I was never going to finish]. [22] minutes on my run. A ten minute episode costs about fifteen cents. Does listening count as reading? It's open source, link below.

**Pros**
- It has the strongest hook. The viewer hears the result before knowing what it is, and "that's not a podcast" reframes it for a small surprise, which is the job Wes's $500 line does.
- It shows the product itself, not a description of it. Voice quality is the thing people doubt most, and this settles it in four seconds.
- It keeps the whole reference structure from beat 2 onwards, so it's still low risk.

**Cons**
- **X autoplays muted.** Without big burned-in captions and a visible player, the first four seconds are lost. This is the one thing that can't be skipped.
- If the voice sounds robotic, opening on it hurts you. Pick a clip where the narration flows.
- It needs a real episode with interesting sources, which means one more thing to prepare before recording.

---

## Variation E: Field test / day in the life

It expands Wes's proof beat ("three thrift stores, a couple yard sales") into the spine of the video.

> I saved articles for a week and let an app I built turn them into a podcast. Monday: [a piece on X] from my laptop, one click. Tuesday: shared [Y] from my iPhone, straight from Safari. Thursday: [a long read] I was never going to finish. Sunday, 7am: an episode is waiting in my podcast app. [Play 3s.] Here's how it works: the extension saves the page, a background job writes one script across everything, text to speech records it. Chrome extension, Wasp app, OpenAI. Stick around for the price. [14] articles, [22] minutes, heard it on my run. Cost: about fifteen cents. Does listening count as reading? Open source, link below.

**Pros**
- It shows every entry point: desktop click, the iPhone shortcut, the scheduled episode, the podcast feed. That's the most complete tour of the product.
- A narrative through the week holds attention on its own.
- Real article titles on screen make it feel authentic.

**Cons**
- A week of setup footage is the most production work of the five.
- The hook ("I saved articles for a week") is flat, and the payoff lands around 20 seconds, which is too late for X.
- Covering the whole timeline pushes it toward 60s or beyond.

---

## Pick: Variation D (audio cold open)

**The criterion:** what made Wes's video work was **showing the payoff before the explanation**. So pick the variation that delivers Tabcast's payoff fastest and most convincingly, while keeping the rest of the proven structure.

- Wes's payoff is something you can see (the item, the price). Tabcast's payoff is something you hear. **D is the only variation where the first seconds are the product working**, not someone talking about it. A and B describe the result; D plays it.
- The question most viewers will have about an "AI podcast" is whether it sounds bad. D answers that before they can scroll away. The other variations leave it open or answer it at 20s or later.
- From beat 2 onwards D *is* Variation A, so it keeps the verb chain, the price open loop, and the bait question.
- The Wasp plug stays in as one line in the stack beat. That matches the project rule "keep the showcase small", and doesn't hand the video to C's developer-only audience. If you also want a developer version, cut C as a second, separate post aimed at the Wasp audience instead of mixing the two.

**Conditions for D to work:**
1. Burned-in captions from the first frame, big and high contrast, plus a podcast player UI on screen so it reads as audio while muted.
2. Pick the cold-open clip for the *source*: a title people recognise or an oddly specific one, as with Wes's "stuffed pheasant." Specific is more interesting than impressive.
3. Check the fifteen cent figure against a real episode in the OpenAI usage dashboard. The price payoff only works if the number is exact.
4. Keep the full script to about 140 words. Read it aloud with a timer; Wes lands at 54s.
