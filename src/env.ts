import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    GEMINI_API_KEY: z.string().min(1),
    GOOGLE_MAPS_API_KEY: z.string().min(1),
  },

  clientPrefix: "VITE_",
  client: {
    VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    VITE_CONVEX_URL: z.string().min(1),
    VITE_GOOGLE_MAPS_API_KEY: z.string().min(1),
  },

  runtimeEnv: {
    ...process.env,
    ...import.meta.env,
  },

  emptyStringAsUndefined: true,
});
