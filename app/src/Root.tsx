import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { logout, useAuth } from "wasp/client/auth";
import { cn } from "./lib/utils";
import { PoweredBy } from "./components/PoweredBy";
import "./Main.css";

// The header runs the full width of the page, its contents held to a 1200px
// column so they never drift to the edges of an ultrawide screen: a dateline
// and the nav on the first row, a hairline, the wordmark, then one more
// hairline edge to edge. The content sits in a 640px column below it, which
// opens to 800px from 1536px wide so it does not look lost on a large screen.
export function Root() {
  const { data: user } = useAuth();
  const { pathname } = useLocation();
  // Set after mount so the prerendered HTML and the browser agree.
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b px-6 sm:px-10">
        <div className="mx-auto w-full max-w-[1200px]">
          <div className="kicker flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b pt-5 pb-3">
            <span>{today}</span>
            {user && (
              <nav className="flex items-center gap-5">
                <NavLink to="/" active={pathname === "/"}>
                  Inbox
                </NavLink>
                <NavLink
                  to="/episodes"
                  active={pathname.startsWith("/episodes")}
                >
                  Episodes
                </NavLink>
                <NavLink to="/setup" active={pathname === "/setup"}>
                  Setup
                </NavLink>
                <span className="hidden normal-case tracking-normal sm:inline">
                  {accountLabel(user.identities)}
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="kicker py-1 hover:text-foreground hover:cursor-pointer"
                >
                  Log out
                </button>
              </nav>
            )}
          </div>
          <Link
            to="/"
            className="block pt-3 pb-4 font-heading text-[22px] leading-none font-medium tracking-tight"
          >
            Tabcast
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[640px] px-6 pt-20 pb-16 2xl:max-w-[800px]">
        <Outlet />
      </main>
      <PoweredBy />
    </div>
  );
}

// Wasp types `identities` for the active auth method only. This reads whichever
// exists, so the header works on an instance switched to username auth.
function accountLabel(identities: object): string {
  const ids = identities as Record<string, { id: string } | null | undefined>;
  return ids.email?.id ?? ids.username?.id ?? "";
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
    <Link
      to={to}
      className={cn(
        "kicker border-b-2 py-1 hover:text-foreground",
        active ? "border-rubric text-foreground" : "border-transparent",
      )}
    >
      {children}
    </Link>
  );
}
