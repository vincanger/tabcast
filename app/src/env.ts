import * as z from "zod";
import { defineEnvValidationSchema } from "wasp/env";

export const serverEnvValidationSchema = defineEnvValidationSchema(
  z.object({
    // Set to false on a private instance. The signup page stays, but the
    // server refuses every signup, including ones made with curl.
    SIGNUPS_OPEN: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),

    // Episodes an account may generate, counting scheduled ones and not
    // counting failures. 0 means no limit. The hosted demo sets 3 and points
    // people at deploying their own.
    EPISODES_PER_USER: z.coerce.number().int().min(0).default(0),

    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required."),
    OPENAI_SCRIPT_MODEL: z.string().default("gpt-4o-mini"),
    OPENAI_TTS_MODEL: z.string().default("tts-1"),
    OPENAI_TTS_VOICE: z.string().default("alloy"),

    S3_BUCKET: z.string().min(1, "S3_BUCKET is required."),
    S3_REGION: z.string().default("us-east-1"),
    S3_ACCESS_KEY_ID: z.string().min(1, "S3_ACCESS_KEY_ID is required."),
    S3_SECRET_ACCESS_KEY: z.string().min(1, "S3_SECRET_ACCESS_KEY is required."),
    // Optional. Set for S3 compatible providers such as MinIO, R2, or Tigris.
    S3_ENDPOINT: z.string().url().optional(),
  }),
);
