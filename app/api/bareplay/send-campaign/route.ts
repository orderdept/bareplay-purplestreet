import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getBarePlayData } from "../../../../lib/bareplay-data";
import { recordConvexCompletedCampaign } from "../../../../lib/convex-server";
import { sendHostedBarePlayCampaign } from "../../../../lib/bareplay-mail";

export const runtime = "nodejs";
export const maxDuration = 300;

async function requestPassword(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { password?: unknown };
  return typeof body.password === "string" ? body.password : "";
}

function intervalMs(dailyLimit: number, perSecond: number, spacingMode: "rate" | "daily") {
  if (spacingMode === "daily") {
    return Math.ceil((24 * 60 * 60 * 1000) / Math.max(1, dailyLimit || 1));
  }
  return Math.ceil(1000 / Math.max(1, Math.min(5, perSecond || 1)));
}

export async function POST(request: Request) {
  try {
    const data = await getBarePlayData();
    const template = data.latestTemplate;
    const password = await requestPassword(request);

    if (!template) {
      return NextResponse.json({ error: "Save a message template first." }, { status: 400 });
    }
    if (!password.trim()) {
      return NextResponse.json({ error: "Enter the mailbox password before starting the campaign." }, { status: 400 });
    }

    const suppressions = new Set(data.suppressions);
    const seen = new Set<string>();
    let duplicateCount = 0;
    let suppressedCount = 0;
    const recipients = [...data.draft.csvContacts, ...data.draft.typedContacts].filter((contact) => {
      if (suppressions.has(contact.email)) {
        suppressedCount += 1;
        return false;
      }
      if (seen.has(contact.email)) {
        duplicateCount += 1;
        return false;
      }
      seen.add(contact.email);
      return true;
    });

    if (!recipients.length) {
      return NextResponse.json({ error: "No ready recipients are loaded for this campaign." }, { status: 400 });
    }

    const spacing = intervalMs(data.draft.dailyLimit, data.draft.perSecond, data.draft.spacingMode);
    const result = await sendHostedBarePlayCampaign(data.draft, template.message, recipients, { password }, spacing);
    const sentCount = result.results.filter((row) => row.status === "sent").length;
    const failedRows = result.results.filter((row) => row.status === "failed");
    const failedCount = failedRows.length;
    const recentLog = result.results
      .slice(-20)
      .map((row) => `${row.status === "sent" ? "Sent" : "Failed"} ${row.email} at ${new Date(row.recordedAt).toLocaleString()}`);

    await recordConvexCompletedCampaign({
      dailyLimit: data.draft.dailyLimit,
      duplicateCount,
      failedCount,
      fromName: result.fromName,
      intervalMs: spacing,
      recentFailures: failedRows.slice(-20),
      recentLog,
      sentCount,
      subject: template.message.subject || data.draft.campaignName || "BarePlay campaign",
      suppressedCount,
      totalRecipients: recipients.length,
      username: result.from,
    });

    revalidatePath("/bareplay-email");

    return NextResponse.json({
      ok: true,
      message: `Campaign finished: sent ${sentCount} of ${recipients.length}${failedCount ? `, ${failedCount} failed` : ""}.`,
      sentCount,
      failedCount,
      totalRecipients: recipients.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Campaign send failed." },
      { status: 500 },
    );
  }
}
