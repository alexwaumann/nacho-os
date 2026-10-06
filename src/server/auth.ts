import { createRemoteJWKSet, jwtVerify } from "jose";

import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader, setResponseStatus } from "@tanstack/react-start/server";

import { env } from "@/env";

type ClerkWindow = Window & {
  Clerk?: { session?: { getToken: () => Promise<string | null> } | null };
};

function unauthorized() {
  setResponseStatus(401);
  return new Error("Unauthorized");
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks() {
  jwks ??= createRemoteJWKSet(new URL("/.well-known/jwks.json", env.CLERK_JWT_ISSUER_DOMAIN));
  return jwks;
}

/**
 * Rejects server function calls that don't carry a valid Clerk session token,
 * so the paid APIs behind them (Gemini, Google Maps) can't be called anonymously.
 */
export const authMiddleware = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const token = await (window as ClerkWindow).Clerk?.session?.getToken();
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  })
  .server(async ({ next }) => {
    const token = getRequestHeader("authorization")?.replace(/^Bearer /, "");
    if (!token) {
      throw unauthorized();
    }

    let userId: string | undefined;
    try {
      const { payload } = await jwtVerify(token, getJwks(), {
        issuer: env.CLERK_JWT_ISSUER_DOMAIN,
      });
      userId = payload.sub;
    } catch {
      throw unauthorized();
    }

    // Outside the try so errors from the server function itself aren't reported as auth failures
    return next({ context: { userId } });
  });
