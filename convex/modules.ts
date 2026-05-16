import { mutation, query } from "./_generated/server";

const now = () => new Date().toISOString();

export const seedBarePlayModule = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("modules")
      .withIndex("by_key", (q) => q.eq("key", "bareplay-email"))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("modules", {
      key: "bareplay-email",
      name: "BarePlay Email",
      status: "planned",
      hostname: "bareplay-email.purplestreet.com",
      businessName: "BarePlay",
      businessEmail: "info@bareplay.org",
      updatedAt: now(),
    });
  },
});

export const listModules = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("modules").collect();
  },
});
