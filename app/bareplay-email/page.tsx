import {
  compactNumber,
  formatDateTime,
  formatRate,
  getBarePlayData,
} from "../../lib/bareplay-data";
import { WorkflowTabs } from "./workflow-tabs";

export const dynamic = "force-dynamic";

export default async function BarePlayEmailPage() {
  const data = await getBarePlayData();
  const draftCampaign = data.currentDraftCampaign;
  const latestCampaign = data.latestCampaign;
  const campaign = draftCampaign;
  const template = data.latestTemplate;
  const remaining = Math.max(
    0,
    (campaign?.total || 0) - (campaign?.sent || 0) - (campaign?.failed || 0),
  );

  return (
    <main className="bareplay-panel">
      <WorkflowTabs
        campaigns={data.campaigns}
        draft={data.draft}
        latestCampaignCompletedAt={
          campaign?.completedAt ? formatDateTime(campaign.completedAt) : "Nothing sent yet"
        }
        latestCampaignSubject={latestCampaign?.subject || template?.message.subject || ""}
        progress={{
          failed: compactNumber(campaign?.failed),
          percent: campaign?.total
            ? Math.min(
                100,
                (((campaign?.sent || 0) + (campaign?.failed || 0)) / campaign.total) * 100,
              )
            : 0,
          processed: campaign?.total
            ? `${compactNumber((campaign?.sent || 0) + (campaign?.failed || 0))} of ${compactNumber(campaign.total)} processed`
            : "No campaign history yet",
          remaining: compactNumber(remaining),
          sendRate: formatRate(campaign?.intervalMs),
          sent: compactNumber(campaign?.sent),
          status: campaign?.status || "Ready",
          subject: campaign?.subject || template?.message.subject || "No subject yet",
          suppressionCount: compactNumber(data.suppressions.length),
        }}
        recentFailures={data.recentFailures}
        recentLog={data.recentLog}
        senderEmail={data.senderEmail}
        senderName={data.senderName}
        suppressions={data.suppressions}
        templateName={template?.name || null}
        templates={data.templates}
      />
    </main>
  );
}
