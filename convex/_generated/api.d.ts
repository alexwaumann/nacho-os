/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as env from "../env.js";
import type * as files from "../files.js";
import type * as jobActions from "../jobActions.js";
import type * as jobs from "../jobs.js";
import type * as lib_ai from "../lib/ai.js";
import type * as lib_geo from "../lib/geo.js";
import type * as payments from "../payments.js";
import type * as receipts from "../receipts.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  env: typeof env;
  files: typeof files;
  jobActions: typeof jobActions;
  jobs: typeof jobs;
  "lib/ai": typeof lib_ai;
  "lib/geo": typeof lib_geo;
  payments: typeof payments;
  receipts: typeof receipts;
  users: typeof users;
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
