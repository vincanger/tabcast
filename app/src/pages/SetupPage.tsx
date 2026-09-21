import { ExtensionCard } from "../components/ExtensionCard";
import { PodcastFeedCard } from "../components/PodcastFeedCard";
import { SaveShortcutCard } from "../components/SaveShortcutCard";

// One-time configuration: how articles get in, and how episodes get out.
export function SetupPage() {
  return (
    <div className="space-y-10">
      <h1 className="kicker border-b pb-2">Setup</h1>
      <ExtensionCard />
      <SaveShortcutCard />
      <PodcastFeedCard />
    </div>
  );
}
