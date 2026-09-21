import { Puzzle } from "lucide-react";
import { config } from "wasp/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

// Where to get the extension. Install steps live in the README so there is
// one copy to keep current; this card links there and shows the two URLs the
// popup's Server settings need for this instance.
// TODO (AGENT): point at the Chrome Web Store listing once it is live.
const EXTENSION_URL = "https://github.com/vincanger/tabcast#get-the-extension";

export function ExtensionCard() {
  const dashboardUrl = window.location.origin;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Puzzle className="size-4 text-primary" />
          Save from Chrome
        </CardTitle>
        <CardDescription>
          The extension saves the article you are reading with one click on its toolbar icon.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            <a
              href={EXTENSION_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="underline hover:text-rubric"
            >
              Get the extension
            </a>{" "}
            and follow the install steps.
          </li>
          <li>
            Click its icon, open <b>Server settings</b>, and enter this app's URLs:
            <div className="mt-2 grid gap-1 font-mono text-xs">
              <span>
                <span className="text-muted-foreground">API server</span> {config.apiUrl}
              </span>
              <span>
                <span className="text-muted-foreground">Dashboard</span> {dashboardUrl}
              </span>
            </div>
          </li>
          <li>Log in with this account. From then on, one click on any article saves it here.</li>
        </ol>
      </CardContent>
    </Card>
  );
}
