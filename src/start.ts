import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

import { authMiddleware } from "@/server/auth";

// Reject cross-site calls to server functions (checks Sec-Fetch-Site / Origin / Referer)
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  // Applies to every server function, so new ones are gated by default
  functionMiddleware: [authMiddleware],
}));
