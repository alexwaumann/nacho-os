import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    // Gemini API key for LLM operations (job extraction, receipt/check analysis, weather risk)
    GEMINI_API_KEY: z.string().min(1).optional(),
    // Google Maps API key for server-side operations (geocoding, directions, places)
    GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  },

  /**
   * The prefix that client-side variables must have. This is enforced both at
   * a type-level and at runtime.
   */
  clientPrefix: "VITE_",

  client: {
    VITE_CLERK_JWT_ISSUER_DOMAIN: z.string().min(1),
    VITE_APP_TITLE: z.string().min(1).optional(),
    VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    VITE_CONVEX_URL: z.string().min(1),
    // Google Maps key for client-side map rendering (referrer-restricted in Google Cloud Console)
    VITE_GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  },

  /**
   * What object holds the environment variables at runtime. This is usually
   * `process.env` or `import.meta.env`.
   */
  runtimeEnv: {
    // Server/Build-time variables
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,

    // Client variables (Vite statically replaces these at build time)
    VITE_CLERK_JWT_ISSUER_DOMAIN: import.meta.env.VITE_CLERK_JWT_ISSUER_DOMAIN,
    VITE_CLERK_PUBLISHABLE_KEY: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    VITE_CONVEX_URL: import.meta.env.VITE_CONVEX_URL,
    VITE_GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  },

  /**
   * By default, this library will feed the environment variables directly to
   * the Zod validator.
   *
   * This means that if you have an empty string for a value that is supposed
   * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
   * it as a type mismatch violation. Additionally, if you have an empty string
   * for a value that is supposed to be a string with a default value (e.g.
   * `DOMAIN=` in an ".env" file), the default value will never be applied.
   *
   * In order to solve these issues, we recommend that all new projects
   * explicitly specify this option as true.
   */
  emptyStringAsUndefined: true,
});
