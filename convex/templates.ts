import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByModule = query({
  args: {
    moduleKey: v.string(),
    campaignName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const campaignName = String(args.campaignName || "").trim();
    if (campaignName) {
      return await ctx.db
        .query("templates")
        .withIndex("by_module_campaign", (q) =>
          q.eq("moduleKey", args.moduleKey).eq("campaignName", campaignName),
        )
        .collect();
    }

    return await ctx.db
      .query("templates")
      .withIndex("by_module", (q) => q.eq("moduleKey", args.moduleKey))
      .collect()
      .then((rows) => rows.filter((row) => !row.campaignName));
  },
});

export const upsertForModule = mutation({
  args: {
    moduleKey: v.string(),
    campaignName: v.optional(v.string()),
    name: v.string(),
    subject: v.string(),
    previewText: v.string(),
    body: v.string(),
    mailingAddress: v.string(),
  },
  handler: async (ctx, args) => {
    const campaignName = String(args.campaignName || "").trim();
    const existing = await ctx.db
      .query("templates")
      .withIndex("by_module_campaign", (q) =>
        q.eq("moduleKey", args.moduleKey).eq("campaignName", campaignName || undefined),
      )
      .collect();

    const match = existing.find(
      (row) => row.name.trim().toLowerCase() === args.name.trim().toLowerCase(),
    );
    const updatedAt = new Date().toISOString();
    const values = {
      campaignName: campaignName || undefined,
      name: args.name.trim(),
      subject: args.subject,
      previewText: args.previewText,
      body: args.body,
      mailingAddress: args.mailingAddress,
      updatedAt,
    };

    if (match) {
      await ctx.db.patch(match._id, values);
      return { id: match._id, updatedAt, replaced: true };
    }

    const id = await ctx.db.insert("templates", {
      moduleKey: args.moduleKey,
      ...values,
    });
    return { id, updatedAt, replaced: false };
  },
});

export const deleteForModule = mutation({
  args: {
    moduleKey: v.string(),
    campaignName: v.optional(v.string()),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const campaignName = String(args.campaignName || "").trim();
    const existing = await ctx.db
      .query("templates")
      .withIndex("by_module_campaign", (q) =>
        q.eq("moduleKey", args.moduleKey).eq("campaignName", campaignName || undefined),
      )
      .collect();

    const match = existing.find(
      (row) => row.name.trim().toLowerCase() === args.name.trim().toLowerCase(),
    );
    if (!match) {
      return { deleted: false };
    }

    await ctx.db.delete(match._id);
    return { deleted: true };
  },
});
