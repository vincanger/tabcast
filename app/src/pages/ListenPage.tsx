import { useParams } from "react-router";
import { Link } from "wasp/client/router";
import { useAuth } from "wasp/client/auth";
import { getPublicEpisode, useQuery } from "wasp/client/operations";
import { EpisodeView } from "../components/EpisodeView";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Skeleton } from "../components/ui/skeleton";

// A shared episode, readable by anyone with the link. Same page as the
// owner sees, minus the controls, plus a line saying what this is.
export function ListenPage() {
  const { id: publicId = "" } = useParams<{ id: string }>();
  const { data: user } = useAuth();

  const { data: episode, isLoading, error } = useQuery(
    getPublicEpisode,
    { publicId },
    // See EpisodePage: a refetch would replace the audio URL and stop playback.
    { enabled: publicId !== "", refetchOnWindowFocus: false, refetchOnReconnect: false },
  );

  if (isLoading) return <Skeleton className="h-56 w-full" />;
  if (error || !episode) {
    return (
      <Alert>
        <AlertDescription>
          This episode is not public, or does not exist. <Link to="/">About Tabcast</Link>.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-8">
      <p className="kicker">
        An episode made with Tabcast ·{" "}
        <Link
          to={user ? "/inbox" : "/signup"}
          className="inline-block py-1 underline decoration-border underline-offset-4 hover:text-foreground"
        >
          {user ? "Your inbox" : "Make your own"} →
        </Link>
      </p>
      <EpisodeView episode={episode} />
    </div>
  );
}
