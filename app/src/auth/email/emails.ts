import type {
  GetPasswordResetEmailContentFn,
  GetVerificationEmailContentFn,
} from "wasp/server/auth";

// Plain text first, HTML as the same words with one link. Nothing reads
// replies to the sending address, so each email says so.

const NO_REPLY = "Replies to this address are not read.";

export const verificationEmail: GetVerificationEmailContentFn = ({ verificationLink }) => ({
  subject: "Confirm your Tabcast account",
  text: `Confirm your email to start saving articles:\n\n${verificationLink}\n\nIf you did not sign up for Tabcast, ignore this message.\n\n${NO_REPLY}`,
  html: `
    <p>Confirm your email to start saving articles.</p>
    <p><a href="${verificationLink}">Confirm my email</a></p>
    <p>If you did not sign up for Tabcast, ignore this message.</p>
    <p style="color:#777">${NO_REPLY}</p>
  `,
});

export const passwordResetEmail: GetPasswordResetEmailContentFn = ({ passwordResetLink }) => ({
  subject: "Reset your Tabcast password",
  text: `Choose a new password here:\n\n${passwordResetLink}\n\nIf you did not ask for this, ignore this message and your password stays as it is.\n\n${NO_REPLY}`,
  html: `
    <p>Choose a new password here.</p>
    <p><a href="${passwordResetLink}">Reset my password</a></p>
    <p>If you did not ask for this, ignore this message and your password stays as it is.</p>
    <p style="color:#777">${NO_REPLY}</p>
  `,
});
