import { LoginForm, SignupForm } from "wasp/client/auth";
import { Link } from "react-router";
import { Card, CardContent } from "../components/ui/card";

// Wasp's auth forms are pre-styled, so we hand them the shadcn theme tokens
// instead of rebuilding the forms ourselves.
const appearance = {
  colors: {
    brand: "var(--primary)",
    brandAccent: "var(--primary)",
    submitButtonText: "var(--primary-foreground)",
    errorBackground: "var(--card)",
    errorText: "var(--destructive)",
    formErrorText: "var(--destructive)",
    successBackground: "var(--card)",
    successText: "var(--foreground)",
    gray700: "var(--foreground)",
    gray600: "var(--muted-foreground)",
    gray500: "var(--muted-foreground)",
    gray400: "var(--border)",
  },
};

function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <Card className="mx-auto mt-12 max-w-sm">
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm appearance={appearance} />
      <p className="text-sm text-muted-foreground">
        No account yet?{" "}
        <Link to="/signup" className="underline">
          Sign up
        </Link>
        .
      </p>
    </AuthLayout>
  );
}

export function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm appearance={appearance} />
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="underline">
          Log in
        </Link>
        .
      </p>
    </AuthLayout>
  );
}
