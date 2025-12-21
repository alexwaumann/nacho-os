import { createServerFn } from "@tanstack/react-start";

import { extractJobFromFile } from "./gemini";
import { geocodeAddress } from "./geo";

import type { ExtractedJob, ImageInput } from "./gemini";

export type ProcessedJob = ExtractedJob & {
  coordinates?: { lat: number; lng: number } | null;
};

/**
 * Process job files: extract job data using Gemini and geocode the address
 * Images should already be converted from PDF on the client side
 */
export const processJobFiles = createServerFn({ method: "POST" })
  .inputValidator((data: { images: Array<ImageInput> }) => data)
  .handler(async ({ data }) => {
    // Step 1: Extract job data from images using Gemini
    const extractedJob = await extractJobFromFile({ data: { images: data.images } });

    // Step 2: Geocode the address
    let coordinates: { lat: number; lng: number } | null = null;
    if (extractedJob.propertyAddress) {
      const result = await geocodeAddress({
        data: { address: extractedJob.propertyAddress },
      });
      coordinates = result;
    }

    return {
      ...extractedJob,
      coordinates,
    } as ProcessedJob;
  });

/**
 * Upload images to Convex storage
 * This is a helper function that will be called from the client
 * after processing is complete
 */
export const prepareJobForStorage = createServerFn({ method: "POST" })
  .inputValidator((data: { job: ProcessedJob; imageStorageIds: Array<string> }) => data)
  .handler(({ data }) => {
    // Transform extracted job data into format suitable for Convex mutation
    const { job, imageStorageIds } = data;

    // Convert extracted tasks to our task format
    const tasks = job.tasks.map((task, index) => ({
      id: `task-${index}-${Date.now()}`,
      text:
        task.specificInstructions ?
          `${task.taskName} - ${task.specificInstructions}`
        : task.taskName,
      requiresOnlineOrder: task.requiresOnlineOrder,
      completed: false,
    }));

    return {
      address: job.propertyAddress,
      summary: job.jobSummary,
      tasks,
      tools: job.toolsNeeded,
      materials: job.materialsNeeded,
      accessCodes: job.accessCodes,
      dueDate: job.targetCompletionDate,
      coordinates: job.coordinates,
      sourceImageIds: imageStorageIds,
    };
  });
