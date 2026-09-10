import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { logout, useAuth } from "wasp/client/auth";
import { cn } from "./lib/utils";
import "./Main.css";

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
      <header className="border-b-[3px] border-double">
        <div className="mx-auto max-w-3xl px-5">
          <div className="kicker flex items-center justify-between gap-4 border-b py-2">
            <span>{today}</span>
            {user && (
              <nav className="flex items-center gap-5">
                <NavLink to="/" active={pathname === "/"}>
                  Inbox
                </NavLink>
                <NavLink to="/episodes" active={pathname.startsWith("/episodes")}>
                  Episodes
                </NavLink>
                <span className="hidden normal-case tracking-normal sm:inline">
                  {user.identities.username?.id}
                </span>
                <button type="button" onClick={() => logout()} className="kicker hover:text-foreground">
                  Log out
                </button>
              </nav>
            )}
          </div>
          <Link to="/" className="block py-6 text-center font-serif text-4xl font-medium tracking-tight sm:text-5xl">
            Article to Podcast
          </Link>
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
    <Link
      to={to}
      className={cn(
        "kicker border-b-2 pb-px hover:text-foreground",
        active ? "border-rubric text-foreground" : "border-transparent",
      )}
    >
      {children}
    </Link>
  );
}
