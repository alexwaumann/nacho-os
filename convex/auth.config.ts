import type { AuthConfig } from "convex/server";
import { env } from "@/env";

export default {
  providers: [
    {
      domain: env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
