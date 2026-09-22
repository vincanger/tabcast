import { Link, useNavigate } from "react-router";
import { login, signup } from "wasp/client/auth";
import { CredentialsForm } from "../AuthForm";

// For self-hosted instances without an email provider. Not routed by default:
// follow the comment on the auth block in main.wasp.ts to switch to these.
//
// `login` and `signup` are typed for whichever auth method is active, so this
// file casts them. That is what lets it sit in the tree while email auth is
// on, and it is exactly right once usernameAndPassword is.

type Credentials = { username: string; password: string };
type Submit = (data: Credentials) => Promise<unknown>;

export function UsernameLoginPage() {
  const navigate = useNavigate();
  return (
    <CredentialsForm
      heading="Log in"
      identity="username"
      submitLabel="Log in"
      onSubmit={async (username, password) => {
        await (login as unknown as Submit)({ username, password });
        navigate("/");
      }}
    >
      No account yet?{" "}
      <Link to="/signup" className="underline">
        Sign up
      </Link>
      .
    </CredentialsForm>
  );
}

export function UsernameSignupPage() {
  const navigate = useNavigate();
  return (
    <CredentialsForm
      heading="Create an account"
      identity="username"
      submitLabel="Sign up"
      newPassword
      onSubmit={async (username, password) => {
        await (signup as unknown as Submit)({ username, password });
        await (login as unknown as Submit)({ username, password });
        navigate("/");
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
