import { useState, type FormEvent } from "react";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";

// Wasp's ready made auth forms render labels that are not bound to their
// inputs, so screen readers and password managers see unnamed fields. These
// pieces build the same forms by hand; email/ and username/ assemble them.

export const inputClass =
  "w-full border border-input bg-background px-3 py-2 text-base focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring";

export function friendlyError(err: unknown, identity: Identity): string {
  const message = err instanceof Error ? err.message : "";
  if (/invalid credentials/i.test(message)) {
    return `${identity === "email" ? "Email" : "Username"} or password is incorrect. Check both and try again.`;
  }
  return message || "Something went wrong. Check your connection and try again.";
}

export function Shell({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Card className="mx-auto mt-12 max-w-sm">
      <CardContent className="space-y-4">
        <h1 className="font-serif text-2xl font-medium">{heading}</h1>
        {children}
      </CardContent>
    </Card>
  );
}

export function Field({
  id,
  label,
  error,
  ...input
}: { id: string; label: string; error: string | null } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        name={id}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "auth-error" : undefined}
        className={inputClass}
        {...input}
      />
    </div>
  );
}

export function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p id="auth-error" role="alert" className="text-sm text-destructive">
      {error}
    </p>
  );
}

export type Identity = "email" | "username";

// Login and signup share this: an identity field, a password, one button.
export function CredentialsForm({
  heading,
  identity,
  submitLabel,
  newPassword,
  onSubmit,
  children,
}: {
  heading: string;
  identity: Identity;
  submitLabel: string;
  newPassword?: boolean;
  onSubmit: (id: string, password: string) => Promise<void>;
  children: React.ReactNode;
}) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await onSubmit(id, password);
    } catch (err) {
      setError(friendlyError(err, identity));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell heading={heading}>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {identity === "email" ? (
          <Field id="email" label="Email" type="email" autoComplete="email" value={id} onChange={(e) => setId(e.target.value)} error={error} />
        ) : (
          <Field id="username" label="Username" type="text" autoComplete="username" value={id} onChange={(e) => setId(e.target.value)} error={error} />
        )}
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete={newPassword ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
        />
        <ErrorLine error={error} />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Please wait…" : submitLabel}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">{children}</p>
    </Shell>
  );
}
