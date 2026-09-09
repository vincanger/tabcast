import { Link, Outlet, useLocation } from "react-router";
import { AudioLines } from "lucide-react";
import { logout, useAuth } from "wasp/client/auth";
import { Button } from "./components/ui/button";
import { cn } from "./lib/utils";
import "./Main.css";

export function Root() {
  const { data: user } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <AudioLines className="size-4" />
            </span>
            Article to Podcast
          </Link>
          {user && (
            <nav className="flex items-center gap-1">
              <NavLink to="/" active={pathname === "/"}>
                Inbox
              </NavLink>
              <NavLink to="/episodes" active={pathname.startsWith("/episodes")}>
                Episodes
              </NavLink>
              <span className="mx-2 hidden text-sm text-muted-foreground sm:inline">
                {user.identities.email?.id}
              </span>
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                Log out
              </Button>
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 pt-8 pb-16">
        <Outlet />
      </main>
    </div>
  );
}

function NavLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant="ghost" size="sm">
      <Link to={to} className={cn(!active && "text-muted-foreground")}>
        {children}
      </Link>
    </Button>
  );
}
