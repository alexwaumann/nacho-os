/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as env from "../env.js";
import type * as files from "../files.js";
import type * as jobActions from "../jobActions.js";
import type * as jobPhotos from "../jobPhotos.js";
import type * as jobs from "../jobs.js";
import type * as lib_ai from "../lib/ai.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_geo from "../lib/geo.js";
import type * as lib_jobExtraction from "../lib/jobExtraction.js";
import type * as lib_media from "../lib/media.js";
import type * as lib_routeBriefAgent from "../lib/routeBriefAgent.js";
import type * as lib_routeTiming from "../lib/routeTiming.js";
import type * as lib_routing from "../lib/routing.js";
import type * as lib_voice_agent from "../lib/voice/agent.js";
import type * as lib_voice_globalAgent from "../lib/voice/globalAgent.js";
import type * as lib_voice_globalOps from "../lib/voice/globalOps.js";
import type * as lib_voice_ops from "../lib/voice/ops.js";
import type * as lib_voice_validators from "../lib/voice/validators.js";
import type * as lib_weather from "../lib/weather.js";
import type * as maps from "../maps.js";
import type * as payments from "../payments.js";
import type * as receiptActions from "../receiptActions.js";
import type * as receipts from "../receipts.js";
import type * as routeBriefActions from "../routeBriefActions.js";
import type * as routeBriefs from "../routeBriefs.js";
import type * as users from "../users.js";
import type * as voice from "../voice.js";
import type * as weather from "../weather.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  env: typeof env;
  files: typeof files;
  jobActions: typeof jobActions;
  jobPhotos: typeof jobPhotos;
  jobs: typeof jobs;
  "lib/ai": typeof lib_ai;
  "lib/auth": typeof lib_auth;
  "lib/geo": typeof lib_geo;
  "lib/jobExtraction": typeof lib_jobExtraction;
  "lib/media": typeof lib_media;
  "lib/routeBriefAgent": typeof lib_routeBriefAgent;
  "lib/routeTiming": typeof lib_routeTiming;
  "lib/routing": typeof lib_routing;
  "lib/voice/agent": typeof lib_voice_agent;
  "lib/voice/globalAgent": typeof lib_voice_globalAgent;
  "lib/voice/globalOps": typeof lib_voice_globalOps;
  "lib/voice/ops": typeof lib_voice_ops;
  "lib/voice/validators": typeof lib_voice_validators;
  "lib/weather": typeof lib_weather;
  maps: typeof maps;
  payments: typeof payments;
  receiptActions: typeof receiptActions;
  receipts: typeof receipts;
  routeBriefActions: typeof routeBriefActions;
  routeBriefs: typeof routeBriefs;
  users: typeof users;
  voice: typeof voice;
  weather: typeof weather;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
