import { useState } from "react";
import { Check, Copy, Download, RefreshCw, Smartphone } from "lucide-react";
import { getSaveShortcut, rotateSaveToken, useQuery } from "wasp/client/operations";
import { Button } from "./ui/button";
import { IconSwap } from "./IconSwap";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

// A ready made Shortcut, shared from iCloud. It ships with a placeholder URL;
// the user pastes their own save link into it after adding it.
const SHORTCUT_URL = "https://www.icloud.com/shortcuts/1aae3b75980a43a0adc7ff26b132c505";

// Mirrors PodcastFeedCard: one secret URL per user, copy it, regenerate it.
export function SaveShortcutCard() {
  const { data: shortcut, isLoading } = useQuery(getSaveShortcut);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function rotate() {
    if (
      shortcut?.url &&
      !window.confirm("Regenerate the save link? The Shortcut on your phone will stop working until you update it.")
    ) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await rotateSaveToken();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the save link.");
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
          <Smartphone className="size-4 text-primary" />
          Save from your iPhone
        </CardTitle>
        <CardDescription>
          A Shortcut in the share sheet reads the page with Safari Reader and posts it here, the
          same way the extension does.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? null : shortcut?.url ? (
          <>
            <div className="flex flex-wrap gap-2">
              <input
                readOnly
                value={shortcut.url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Save link for the Shortcut"
                className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 font-mono text-sm"
              />
              <Button variant="outline" onClick={() => copy(shortcut.url!)}>
                <IconSwap
                  active={copied}
                  className="size-4"
                  activeIcon={<Check className="size-4" />}
                  inactiveIcon={<Copy className="size-4" />}
                />
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="ghost" onClick={rotate} disabled={busy}>
                <RefreshCw className="size-4" />
                Regenerate
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can add articles to your inbox. Regenerate it if you lose your
              phone, then update the Shortcut.
            </p>
            <ol className="list-decimal space-y-2 ps-5 text-sm">
              <li>
                <a
                  href={SHORTCUT_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 underline hover:text-rubric"
                >
                  <Download className="size-3.5" />
                  Get the Shortcut
                </a>{" "}
                and add it on your iPhone or Mac.
              </li>
              <li>
                Open it in Shortcuts and, in the <b>Get Contents of URL</b> step, replace the
                placeholder with the link above.
              </li>
              <li>Open any article, tap Share, and pick the shortcut.</li>
            </ol>
          </>
        ) : (
          <Button onClick={rotate} disabled={busy}>
            <Smartphone className="size-4" />
            Create save link
          </Button>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
