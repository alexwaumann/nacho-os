import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Reusable validators
const coordinatesValidator = v.object({
  lat: v.number(),
  lng: v.number(),
});

const taskValidator = v.object({
  id: v.string(),
  category: v.string(),
  taskName: v.string(),
  specificInstructions: v.optional(v.string()),
  quantity: v.optional(v.number()),
  unit: v.optional(v.string()),
  materials: v.optional(v.array(v.string())),
  tools: v.optional(v.array(v.string())),
  requiresOnlineOrder: v.boolean(),
  completed: v.boolean(),
});

const weatherDataValidator = v.object({
  tempMax: v.number(),
  precipProb: v.number(),
  condition: v.string(),
  code: v.number(),
});

const weatherRiskValidator = v.object({
  hasRisk: v.boolean(),
  reason: v.optional(v.string()),
});

export default defineSchema({
  // Users table - synced from Clerk
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    homeAddress: v.optional(v.string()),
    homeCoordinates: v.optional(coordinatesValidator),
    settings: v.optional(
      v.object({
        theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),
      }),
    ),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // Jobs table - main work items
  jobs: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("start"), v.literal("end"), v.literal("stop")),
    address: v.string(),
    summary: v.optional(v.string()),
    tasks: v.optional(v.array(taskValidator)),
    accessCodes: v.optional(v.array(v.string())),
    dueDate: v.optional(v.string()),
    coordinates: v.optional(coordinatesValidator),
    notes: v.optional(v.string()),

    // Source document - array of image storage IDs (multi-page PDFs become multiple images)
    sourceImageIds: v.optional(v.array(v.id("_storage"))),

    // State
    selectedForRoute: v.boolean(),

    // Status
    status: v.union(v.literal("pending"), v.literal("completed"), v.literal("paid")),
    completedOn: v.optional(v.string()),
    paidOn: v.optional(v.string()),

    // Route metrics (from Google Maps)
    travelTime: v.optional(v.string()),
    distance: v.optional(v.string()),
    travelTimeValue: v.optional(v.number()),
    distanceValue: v.optional(v.number()),

    // Weather
    weather: v.optional(weatherDataValidator),
    weatherRisk: v.optional(weatherRiskValidator),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_selected", ["userId", "selectedForRoute"]),

  // Receipts table - expenses for jobs
  receipts: defineTable({
    userId: v.id("users"),
    jobId: v.id("jobs"),
    imageId: v.id("_storage"),
    storeName: v.string(),
    storeLocation: v.optional(v.string()),
    summary: v.optional(v.string()),
    total: v.number(),
    date: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_job", ["jobId"]),

  // Payments table - check payments for jobs
  payments: defineTable({
    userId: v.id("users"),
    jobId: v.id("jobs"),
    imageId: v.id("_storage"),
    amount: v.number(),
    payerName: v.optional(v.string()),
    detectedAddress: v.optional(v.string()),
    date: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_job", ["jobId"]),
});
