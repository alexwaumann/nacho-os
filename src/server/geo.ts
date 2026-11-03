// The Google Maps server functions moved to Convex (convex/maps.ts). This re-export only remains
// for src/server/routeBrief.ts and goes away once the route brief moves to Convex too.
export { calculateDistance } from "../../convex/lib/routing";
