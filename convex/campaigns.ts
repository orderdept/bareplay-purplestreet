import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listCampaigns = query({
  args: {
    moduleKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.moduleKey) {
      return await ctx.db
        .query("campaigns")
        .withIndex("by_module", (query) => query.eq("moduleKey", args.moduleKey || ""))
        .collect();
    }
    return await ctx.db.query("campaigns").collect();
  },
});

export const recordCompleted = mutation({
  args: {
    moduleKey: v.string(),
    subject: v.string(),
    totalRecipients: v.number(),
    sentCount: v.number(),
    failedCount: v.number(),
    suppressedCount: v.number(),
    duplicateCount: v.number(),
    dailyLimit: v.number(),
    intervalMs: v.number(),
    recentFailures: v.array(
      v.object({
        email: v.string(),
        error: v.optional(v.string()),
        name: v.optional(v.string()),
        recordedAt: v.optional(v.string()),
        status: v.union(v.literal("sent"), v.literal("failed")),
      }),
    ),
    recentLog: v.array(v.string()),
    smtp: v.object({
      fromName: v.optional(v.string()),
      username: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();
    const id = await ctx.db.insert("campaigns", {
      moduleKey: args.moduleKey,
      status: args.failedCount > 0 ? "failed" : "complete",
      subject: args.subject,
      totalRecipients: args.totalRecipients,
      sentCount: args.sentCount,
      failedCount: args.failedCount,
      suppressedCount: args.suppressedCount,
      duplicateCount: args.duplicateCount,
      dailyLimit: args.dailyLimit,
      intervalMs: args.intervalMs,
      currentBatch: args.totalRecipients,
      totalBatches: args.totalRecipients,
      recentFailures: args.recentFailures,
      recentLog: args.recentLog,
      smtp: args.smtp,
      nextRunAt: undefined,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return await ctx.db.get(id);
  },
});
