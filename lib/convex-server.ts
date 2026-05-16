import { ConvexHttpClient } from "convex/browser";

import { api } from "../convex/_generated/api";
import { type CampaignDraft, type CampaignMessage, type SavedTemplate } from "./bareplay-types";

export const moduleKey = "bareplay-email";

export type SuppressionSource = "manual" | "bounce" | "unsubscribe" | "import";

export function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    return null;
  }
  return new ConvexHttpClient(url);
}

export async function getConvexSuppressions() {
  const client = getConvexClient();
  if (!client) {
    return null;
  }
  const rows = await client.query(api.suppressions.listByModule, { moduleKey });
  return rows.map((row) => ({
    email: row.email,
    source: row.source,
    note: row.note,
    createdAt: row.createdAt,
  }));
}

export async function replaceConvexSuppressions(
  items: Array<{ email: string; source: SuppressionSource; note?: string }>,
) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.suppressions.replaceForModule, {
    moduleKey,
    items,
  });
}

export async function addConvexSuppression(
  email: string,
  source: SuppressionSource = "manual",
  note?: string,
) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.suppressions.addForModule, {
    moduleKey,
    email,
    source,
    note,
  });
}

export async function getConvexCampaigns() {
  const client = getConvexClient();
  if (!client) {
    return null;
  }
  const rows = await client.query(api.campaigns.listCampaigns, { moduleKey });
  return rows.map((row) => ({
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    currentBatch: row.currentBatch,
    dailyLimit: row.dailyLimit,
    failed: row.failedCount,
    id: String(row._id),
    intervalMs: row.intervalMs,
    nextRunAt: row.nextRunAt,
    recentFailures: row.recentFailures,
    recentLog: row.recentLog,
    sent: row.sentCount,
    smtp: row.smtp,
    status: row.status,
    subject: row.subject,
    total: row.totalRecipients,
    totalBatches: row.totalBatches,
  }));
}

export async function recordConvexCompletedCampaign(args: {
  dailyLimit: number;
  duplicateCount: number;
  failedCount: number;
  fromName: string;
  intervalMs: number;
  recentFailures: Array<{ email: string; error?: string; name?: string; recordedAt?: string; status: "sent" | "failed" }>;
  recentLog: string[];
  sentCount: number;
  subject: string;
  suppressedCount: number;
  totalRecipients: number;
  username: string;
}) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.campaigns.recordCompleted, {
    moduleKey,
    subject: args.subject,
    totalRecipients: args.totalRecipients,
    sentCount: args.sentCount,
    failedCount: args.failedCount,
    suppressedCount: args.suppressedCount,
    duplicateCount: args.duplicateCount,
    dailyLimit: args.dailyLimit,
    intervalMs: args.intervalMs,
    recentFailures: args.recentFailures,
    recentLog: args.recentLog,
    smtp: {
      fromName: args.fromName,
      username: args.username,
    },
  });
}

export async function getConvexTemplates(campaignName: string) {
  const client = getConvexClient();
  if (!client) {
    return null;
  }
  const rows = await client.query(api.templates.listByModule, { moduleKey, campaignName: campaignName.trim() });
  return rows.map<SavedTemplate>((row) => ({
    id: String(row._id),
    name: row.name,
    updatedAt: row.updatedAt,
    message: {
      subject: row.subject,
      previewText: row.previewText,
      body: row.body,
      mailingAddress: row.mailingAddress,
    },
  }));
}

export async function getConvexCampaignDraft() {
  const client = getConvexClient();
  if (!client) {
    return null;
  }
  const row = await client.query(api.campaignDrafts.getByModule, { moduleKey });
  if (!row) {
    return null;
  }
  return {
    campaignName: row.campaignName || "",
    draftMessageName: row.draftMessageName || "",
    messageSubject: row.messageSubject || "",
    messagePreviewText: row.messagePreviewText || "",
    messageBody: row.messageBody || "",
    messageMailingAddress: row.messageMailingAddress || "",
    csvContacts: row.csvContacts,
    typedContacts: row.typedContacts,
    pasteText: row.pasteText,
    smtpHost: row.smtpHost,
    smtpPort: row.smtpPort,
    smtpSecurity: row.smtpSecurity,
    smtpUsername: row.smtpUsername,
    fromName: row.fromName,
    dailyLimit: row.dailyLimit,
    perSecond: row.perSecond,
    spacingMode: row.spacingMode,
    updatedAt: row.updatedAt,
  } satisfies CampaignDraft;
}

export async function upsertConvexTemplate(campaignName: string, name: string, message: CampaignMessage) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.templates.upsertForModule, {
    moduleKey,
    campaignName: campaignName.trim(),
    name,
    ...message,
  });
}

export async function deleteConvexTemplate(campaignName: string, name: string) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.templates.deleteForModule, {
    moduleKey,
    campaignName: campaignName.trim(),
    name,
  });
}

export async function upsertConvexCampaignDraft(draft: CampaignDraft) {
  const client = getConvexClient();
  if (!client) {
    throw new Error("Convex is not configured.");
  }
  return await client.mutation(api.campaignDrafts.upsertForModule, {
    moduleKey,
    campaignName: draft.campaignName,
    draftMessageName: draft.draftMessageName,
    messageSubject: draft.messageSubject,
    messagePreviewText: draft.messagePreviewText,
    messageBody: draft.messageBody,
    messageMailingAddress: draft.messageMailingAddress,
    csvContacts: draft.csvContacts,
    typedContacts: draft.typedContacts,
    pasteText: draft.pasteText,
    smtpHost: draft.smtpHost,
    smtpPort: draft.smtpPort,
    smtpSecurity: draft.smtpSecurity,
    smtpUsername: draft.smtpUsername,
    fromName: draft.fromName,
    dailyLimit: draft.dailyLimit,
    perSecond: draft.perSecond,
    spacingMode: draft.spacingMode,
    updatedAt: draft.updatedAt || new Date().toISOString(),
  });
}
