import { createFileRoute, redirect } from "@tanstack/react-router";

// The map now lives on the Jobs page; keep old links and the nav tab working
export const Route = createFileRoute("/map")({
  beforeLoad: () => {
    throw redirect({ to: "/jobs", search: { view: "map" }, replace: true });
  },
});
