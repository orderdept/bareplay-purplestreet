"use client";

import { useEffect, useState } from "react";

import { type CampaignDraft, type SavedTemplate } from "../../lib/bareplay-types";
import { CampaignDesk } from "./campaign-desk";
import { CampaignWorkspace } from "./campaign-workspace";
import { ImportBouncesButton } from "./import-bounces-button";
import { SuppressionSearch } from "./suppression-search";
import { TemplateManager } from "./template-manager";

type CampaignHistoryItem = {
  id: string;
  status?: string;
  subject?: string;
  total?: number;
  sent?: number;
  failed?: number;
  createdAt?: string;
  completedAt?: string | null;
};

type FailureRow = {
  email: string;
  error?: string;
  recordedAt?: string;
};

type Props = {
  campaigns: CampaignHistoryItem[];
  draft: CampaignDraft;
  latestCampaignSubject?: string;
  recentFailures: FailureRow[];
  recentLog: string[];
  suppressions: string[];
  templateName?: string | null;
  templates: SavedTemplate[];
};

const tabs = [
  { id: "campaign", label: "Campaign Desk" },
  { id: "message", label: "Message" },
  { id: "audience", label: "Audience" },
  { id: "delivery", label: "Delivery" },
  { id: "final", label: "Final Check" },
  { id: "hygiene", label: "Hygiene" },
  { id: "logs", label: "Logs" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function compactNumber(value?: number | null) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

export function WorkflowTabs({
  campaigns,
  draft,
  latestCampaignSubject = "",
  recentFailures,
  recentLog,
  suppressions,
  templateName,
  templates,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("campaign");

  useEffect(() => {
    const savedTab = window.sessionStorage.getItem("bareplay-email-active-tab") as TabId | null;
    if (savedTab && tabs.some((tab) => tab.id === savedTab)) {
      setActiveTab(savedTab);
    }
  }, []);

  function chooseTab(tab: TabId) {
    setActiveTab(tab);
    window.sessionStorage.setItem("bareplay-email-active-tab", tab);
  }

  return (
    <section className="workflow-tabs-shell">
      <div className="workflow-tab-list" role="tablist" aria-label="BarePlay email workflow">
        {tabs.map((tab) => (
          <button
            aria-controls={`bareplay-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            className="workflow-tab"
            id={`bareplay-tab-button-${tab.id}`}
            key={tab.id}
            onClick={() => chooseTab(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        aria-labelledby="bareplay-tab-button-campaign"
        hidden={activeTab !== "campaign"}
        id="bareplay-tab-campaign"
        role="tabpanel"
      >
        <CampaignDesk draft={draft} campaigns={campaigns} />
      </div>

      <div
        aria-labelledby="bareplay-tab-button-message"
        hidden={activeTab !== "message"}
        id="bareplay-tab-message"
        role="tabpanel"
      >
        <TemplateManager draft={draft} templates={templates} />
      </div>

      <div
        aria-labelledby={`bareplay-tab-button-${activeTab}`}
        hidden={!["audience", "delivery", "final"].includes(activeTab)}
        id={`bareplay-tab-${activeTab}`}
        role="tabpanel"
      >
        <CampaignWorkspace
          activePanel={activeTab === "delivery" ? "delivery" : activeTab === "final" ? "final" : "audience"}
          draft={draft}
          suppressions={suppressions}
          templateName={templateName}
        />
      </div>

      <div
        aria-labelledby="bareplay-tab-button-hygiene"
        hidden={activeTab !== "hygiene"}
        id="bareplay-tab-hygiene"
        role="tabpanel"
      >
        <article className="panel">
          <p className="section-step">List hygiene</p>
          <h2>Suppressions</h2>
          <p>{compactNumber(suppressions.length)} addresses are excluded from future sends.</p>
          <div className="button-row">
            <ImportBouncesButton
              campaignSubject={latestCampaignSubject}
              senderEmail={draft.smtpUsername}
            />
          </div>
          <div className="button-row">
            <a className="action-link" href="/api/bareplay/suppressions/export.csv">
              Download CSV
            </a>
            <a className="action-link ghost" href="/api/bareplay/suppressions/export.json">
              Download JSON
            </a>
          </div>
          <SuppressionSearch suppressions={suppressions} />
        </article>
      </div>

      <div
        aria-labelledby="bareplay-tab-button-logs"
        hidden={activeTab !== "logs"}
        id="bareplay-tab-logs"
        role="tabpanel"
      >
        <div className="content-grid">
          <article className="panel">
            <p className="section-step">Delivery watch</p>
            <h2>Recent failed deliveries</h2>
            {recentFailures.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentFailures.map((row) => (
                      <tr key={`${row.email}-${row.recordedAt || row.error}`}>
                        <td>{row.email}</td>
                        <td>{row.error || "Delivery failed"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No recent failed deliveries recorded.</p>
            )}
          </article>

          <article className="panel">
            <p className="section-step">Activity</p>
            <h2>Recent send log</h2>
            {recentLog.length ? (
              <ul className="activity-list">
                {recentLog.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p>No recent activity recorded.</p>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
