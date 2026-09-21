import { randomBytes } from "node:crypto";

// URL safe secret for the per user tokens that stand in for a session where a
// client cannot log in: the podcast feed and the iOS Shortcut.
export function newSecretToken(): string {
  return randomBytes(24).toString("base64url");
}
