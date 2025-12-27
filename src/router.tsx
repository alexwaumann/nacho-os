import { createRouter } from "@tanstack/react-router";
import { queryClient } from "./integrations/tanstack-query/root-provider";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
  });

  return router;
};
