import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    GEMINI_API_KEY: z.string().min(1),
    GOOGLE_MAPS_API_KEY: z.string().min(1),
    CLERK_JWT_ISSUER_DOMAIN: z.string().min(1),
  },

  runtimeEnv: process.env,

  emptyStringAsUndefined: true,
});
