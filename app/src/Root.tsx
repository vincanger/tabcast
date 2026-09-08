import { Link, Outlet } from "react-router";
import { logout, useAuth } from "wasp/client/auth";
import "./Main.css";

export function Root() {
  const { data: user } = useAuth();

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          Article to Podcast
        </Link>
        {user && (
          <nav className="nav">
            <Link to="/">Inbox</Link>
            <Link to="/episodes">Episodes</Link>
            <span className="muted">{user.identities.email?.id}</span>
            <button className="link" onClick={() => logout()}>
              Log out
            </button>
          </nav>
        )}
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
