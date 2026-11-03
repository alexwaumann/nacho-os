import { v } from "convex/values";

import { taskValidator } from "../../schema";

// Argument validators for the voice actions; they mirror VoiceJobContext, GlobalVoiceContext and
// VoiceFollowUp (see ops.ts and globalOps.ts)

const jobStatusValidator = v.union(v.literal("pending"), v.literal("completed"), v.literal("paid"));

// A job's task as the model sees it: the stored task without its id and page, plus its ref
const { id: _id, page: _page, ...contextTaskFields } = taskValidator.fields;

export const voiceJobContextValidator = v.object({
  address: v.string(),
  summary: v.optional(v.string()),
  status: jobStatusValidator,
  dueDate: v.union(v.string(), v.null()),
  accessCodes: v.array(v.string()),
  notes: v.string(),
  tasks: v.array(v.object({ ...contextTaskFields, ref: v.string() })),
  photos: v.array(v.object({ ref: v.string(), caption: v.optional(v.string()) })),
});

export const voiceFollowUpValidator = v.object({
  transcript: v.string(),
  reply: v.string(),
  applied: v.array(v.string()),
});

export const globalVoiceContextValidator = v.object({
  jobs: v.array(
    v.object({
      ref: v.string(),
      address: v.string(),
      status: jobStatusValidator,
      due: v.optional(v.string()),
      stop: v.optional(v.number()),
      tasks: v.optional(v.string()),
      taskList: v.array(v.string()),
      codes: v.array(v.string()),
      notes: v.optional(v.string()),
    }),
  ),
  route: v.array(v.string()),
  focus: v.optional(v.string()),
  weather: v.optional(
    v.object({
      headline: v.optional(v.string()),
      stops: v.array(
        v.object({ job: v.string(), arrive: v.optional(v.string()), hours: v.array(v.string()) }),
      ),
    }),
  ),
});
