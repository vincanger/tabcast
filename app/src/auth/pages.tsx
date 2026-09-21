import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { login, signup } from "wasp/client/auth";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";

// Wasp's ready made LoginForm and SignupForm render labels that are not bound
// to their inputs, so screen readers and password managers see two unnamed
// fields. This is the same form, written by hand, using Wasp's login and
// signup client functions.
function AuthForm({
  heading,
  submitLabel,
  onSubmit,
  children,
}: {
  heading: string;
  submitLabel: string;
  onSubmit: (username: string, password: string) => Promise<void>;
  children: React.ReactNode;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit(username, password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        /invalid credentials/i.test(message)
          ? "Username or password is incorrect. Check both and try again."
          : message || "Unable to sign in. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full border border-input bg-background px-3 py-2 text-base focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";

  return (
    <Card className="mx-auto mt-12 max-w-sm">
      <CardContent className="space-y-4">
        <h1 className="font-serif text-2xl font-medium">{heading}</h1>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "auth-error" : undefined}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={submitLabel === "Log in" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "auth-error" : undefined}
              className={inputClass}
            />
          </div>
          {error && (
            <p id="auth-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : submitLabel}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">{children}</p>
      </CardContent>
    </Card>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  return (
    <AuthForm
      heading="Log in"
      submitLabel="Log in"
      onSubmit={async (username, password) => {
        await login({ username, password });
        navigate("/");
      }}
    >
      No account yet?{" "}
      <Link to="/signup" className="underline">
        Sign up
      </Link>
      .
    </AuthForm>
  );
}

export function SignupPage() {
  const navigate = useNavigate();
  return (
    <AuthForm
      heading="Create an account"
      submitLabel="Sign up"
      onSubmit={async (username, password) => {
        await signup({ username, password });
        await login({ username, password });
        navigate("/");
      }}
    >
      Already have an account?{" "}
      <Link to="/login" className="underline">
        Log in
      </Link>
      .
    </AuthForm>
  );
}
