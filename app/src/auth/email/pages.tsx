import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Link, routes } from "wasp/client/router";
import { login, requestPasswordReset, resetPassword, signup, verifyEmail } from "wasp/client/auth";
import { Button } from "../../components/ui/button";
import { CredentialsForm, ErrorLine, Field, Shell, friendlyError } from "../AuthForm";

// Email auth pages, routed from main.wasp.ts. The shared pieces live in
// ../AuthForm.tsx; the username variant for self-hosters is in ../username/.

export function LoginPage() {
  const navigate = useNavigate();
  return (
    <CredentialsForm
      heading="Log in"
      identity="email"
      submitLabel="Log in"
      onSubmit={async (email, password) => {
        await login({ email, password });
        navigate(routes.InboxRoute.build());
      }}
    >
      No account yet?{" "}
      <Link to="/signup" className="underline">
        Sign up
      </Link>
      .{" "}
      <Link to="/request-password-reset" className="underline">
        Forgot your password?
      </Link>
    </CredentialsForm>
  );
}

export function SignupPage() {
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <Shell heading="Check your inbox">
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link. Open it, then{" "}
          <Link to="/login" className="underline">
            log in
          </Link>
          . Nothing arrived after a minute? Look in spam, then sign up again to resend it.
        </p>
      </Shell>
    );
  }
  return (
    <CredentialsForm
      heading="Create an account"
      identity="email"
      submitLabel="Sign up"
      newPassword
      onSubmit={async (email, password) => {
        await signup({ email, password });
        setSent(true);
      }}
    >
      Already have an account?{" "}
      <Link to="/login" className="underline">
        Log in
      </Link>
      .
    </CredentialsForm>
  );
}

export function EmailVerificationPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"working" | "done" | "failed">("working");

  useEffect(() => {
    if (!token) {
      setState("failed");
      return;
    }
    verifyEmail({ token })
      .then((r) => setState(r.success ? "done" : "failed"))
      .catch(() => setState("failed"));
  }, [token]);

  return (
    <Shell heading={state === "done" ? "Email confirmed" : state === "failed" ? "Link did not work" : "Confirming…"}>
      <p className="text-sm text-muted-foreground">
        {state === "done" && (
          <>
            You can{" "}
            <Link to="/login" className="underline">
              log in
            </Link>{" "}
            now.
          </>
        )}
        {state === "failed" && (
          <>
            The link is missing, expired, or already used.{" "}
            <Link to="/signup" className="underline">
              Sign up again
            </Link>{" "}
            to get a fresh one.
          </>
        )}
        {state === "working" && "One moment."}
      </p>
    </Shell>
  );
}

export function RequestPasswordResetPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <Shell heading="Check your inbox">
        <p className="text-sm text-muted-foreground">
          If an account exists for that address, a reset link is on its way. It is good for a short while.
        </p>
      </Shell>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset({ email });
      setSent(true);
    } catch (err) {
      setError(friendlyError(err, "email"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell heading="Reset your password">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
        <ErrorLine error={error} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : "Send reset link"}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link to="/login" className="underline">
          Log in
        </Link>
        .
      </p>
    </Shell>
  );
}

export function PasswordResetPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("This link is missing its token. Request a new one.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resetPassword({ token, password });
      navigate(routes.LoginRoute.build());
    } catch (err) {
      setError(friendlyError(err, "email"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell heading="Choose a new password">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field
          id="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />
        <ErrorLine error={error} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : "Save password"}
        </Button>
      </form>
    </Shell>
  );
}
