import { router } from "expo-router";

/** Open the Add Job sheet (scan paperwork, take a photo or choose photos) */
export function openAddJob() {
  router.push("/add-job");
}
