import { HttpError, env } from "wasp/server";
import type { OnBeforeSignupHook } from "wasp/server/auth";

// Removing the signup page is not enough: Wasp always serves
// POST /auth/email/signup (or /auth/username/signup). This is the gate that actually closes it, for
// people who deploy their own instance and want to be its only user.
export const onBeforeSignup: OnBeforeSignupHook = async () => {
  if (!env.SIGNUPS_OPEN) {
    throw new HttpError(403, "Signups are closed on this instance.");
  }
};
