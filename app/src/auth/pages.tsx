import {
  ForgotPasswordForm,
  LoginForm,
  ResetPasswordForm,
  SignupForm,
  VerifyEmailForm,
} from "wasp/client/auth";
import { Link } from "react-router";

function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="auth-card">{children}</div>;
}

export function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
      <p className="muted">
        No account yet? <Link to="/signup">Sign up</Link>. Forgot your password?{" "}
        <Link to="/request-password-reset">Reset it</Link>.
      </p>
    </AuthLayout>
  );
}

export function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm />
      <p className="muted">
        Already have an account? <Link to="/login">Log in</Link>.
      </p>
    </AuthLayout>
  );
}

export function EmailVerificationPage() {
  return (
    <AuthLayout>
      <VerifyEmailForm />
      <p className="muted">
        Verified? <Link to="/login">Go to login</Link>.
      </p>
    </AuthLayout>
  );
}

export function RequestPasswordResetPage() {
  return (
    <AuthLayout>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}

export function PasswordResetPage() {
  return (
    <AuthLayout>
      <ResetPasswordForm />
      <p className="muted">
        Done? <Link to="/login">Go to login</Link>.
      </p>
    </AuthLayout>
  );
}
