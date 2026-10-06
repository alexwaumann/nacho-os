import { createStart } from "@tanstack/react-start";

import { authMiddleware } from "@/server/auth";

// Applies to every server function, so new ones are gated by default
export const startInstance = createStart(() => ({
  functionMiddleware: [authMiddleware],
}));
