import { useState } from "react";
import { Check, Copy, RefreshCw, Rss } from "lucide-react";
import { getFeed, rotateFeedToken, useQuery } from "wasp/client/operations";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

export function PodcastFeedCard() {
  const { data: feed, isLoading } = useQuery(getFeed);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wasp refetches getFeed on its own after the action, since both touch User.
  async function rotate() {
    if (
      feed?.url &&
      !window.confirm(
        "Regenerate the feed link? Every subscriber, including your own devices, will be disconnected.",
      )
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await rotateFeedToken();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the feed.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rss className="size-4 text-primary" />
          Podcast feed
        </CardTitle>
        <CardDescription>
          Listen in any podcast app. In Apple Podcasts on a Mac, choose File, then Add a Show by
          URL, and it syncs to your phone from there.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? null : feed?.url ? (
          <>
            <div className="flex flex-wrap gap-2">
              <input
                readOnly
                value={feed.url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Podcast feed URL"
                className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 font-mono text-sm"
              />
              <Button variant="outline" onClick={() => copy(feed.url!)}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="ghost" onClick={rotate} disabled={busy}>
                <RefreshCw className="size-4" />
                Regenerate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can listen. Regenerating it disconnects every subscriber,
              including your own devices.
            </p>
          </>
        ) : (
          <Button onClick={rotate} disabled={busy}>
            <Rss className="size-4" />
            Enable podcast feed
          </Button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
