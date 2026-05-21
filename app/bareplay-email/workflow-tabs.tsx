"use client";

import Link from "next/link";
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
  latestCampaignCompletedAt?: string;
  latestCampaignSubject?: string;
  progress: {
    failed: string;
    percent: number;
    processed: string;
    remaining: string;
    sendRate: string;
    sent: string;
    status: string;
    subject: string;
    suppressionCount: string;
  };
  recentFailures: FailureRow[];
  recentLog: string[];
  senderEmail: string;
  senderName: string;
  suppressions: string[];
  templateName?: string | null;
  templates: SavedTemplate[];
};

const tabs = [
  { id: "campaign", label: "Campaign Desk", eyebrow: "Before Step 1" },
  { id: "message", label: "Message", eyebrow: "Step 1" },
  { id: "audience", label: "Audience", eyebrow: "Step 2" },
  { id: "delivery", label: "Delivery", eyebrow: "Step 3" },
  { id: "final", label: "Final Check", eyebrow: "Step 4" },
  { id: "hygiene", label: "Hygiene", eyebrow: "List Health" },
  { id: "logs", label: "Logs", eyebrow: "Delivery Watch" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function compactNumber(value?: number | null) {
  return new Intl.NumberFormat("en-US").format(value || 0);
}

export function WorkflowTabs({
  campaigns,
  draft,
  latestCampaignCompletedAt = "Nothing sent yet",
  latestCampaignSubject = "",
  progress,
  recentFailures,
  recentLog,
  senderEmail,
  senderName,
  suppressions,
  templateName,
  templates,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("campaign");
  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];

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
    <section className="module-shell">
      <aside className="module-sidebar">
        <div className="module-brand">
          <img
            alt="Bare Play"
            className="bareplay-logo"
            src="https://assets.zyrosite.com/cdn-cgi/image/format=auto,w=768,fit=crop/GEZf6CK9JsfiHJQX/bare-play-logo-v5_use-this-one-X2sjRAKnvHC7MYFb.png"
          />
          <p className="eyebrow">Campaign Control</p>
          <h1>BarePlay Email</h1>
        </div>

        <Link className="module-back-link" href="https://purplestreet.com">
          Back to Purplestreet
        </Link>

        <nav className="module-nav" role="tablist" aria-label="BarePlay email workflow">
          {tabs.map((tab) => (
            <button
              aria-controls={`bareplay-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              className="module-nav-link"
              id={`bareplay-tab-button-${tab.id}`}
              key={tab.id}
              onClick={() => chooseTab(tab.id)}
              role="tab"
              type="button"
            >
              <span>{tab.eyebrow}</span>
              <strong>{tab.label}</strong>
            </button>
          ))}
        </nav>

        <button
          className="module-new-campaign"
          onClick={() => chooseTab("campaign")}
          type="button"
        >
          New campaign
        </button>
      </aside>

      <div className="module-main">
        <header className="module-topbar">
          <div>
            <p className="section-step">{activeTabMeta.eyebrow}</p>
            <h2>{activeTabMeta.label}</h2>
            <p>
              Keep the campaign moving without leaving the BarePlay operator
              workspace.
            </p>
          </div>
          <div className="module-topbar-actions">
            <button className="subtle-link module-quick-link" onClick={() => chooseTab("message")} type="button">
              Message
            </button>
            <button className="subtle-link module-quick-link" onClick={() => chooseTab("audience")} type="button">
              Audience
            </button>
            <button className="subtle-link module-quick-link" onClick={() => chooseTab("final")} type="button">
              Final Check
            </button>
            <div className="status-pill">{progress.status}</div>
          </div>
        </header>

        <section className="hero-band module-command-band">
          <div className="hero-band-copy">
            <div className="hero-label-row">
              <span className="hero-kicker">Current campaign</span>
              <span className="hero-inline-meta">{progress.subject}</span>
            </div>
            <div className="hero-progress-row">
              <div className="hero-progress-track" aria-hidden="true">
                <span
                  className="hero-progress-fill"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <strong className="hero-progress-caption">{progress.processed}</strong>
            </div>
          </div>
          <div className="hero-metrics">
            <div className="hero-metric">
              <span>Sender</span>
              <strong>{senderName}</strong>
              <small>{senderEmail}</small>
            </div>
            <div className="hero-metric">
              <span>Completed</span>
              <strong>{latestCampaignCompletedAt}</strong>
              <small>{latestCampaignCompletedAt === "Nothing sent yet" ? "Nothing sent yet" : "Last finished run"}</small>
            </div>
          </div>
        </section>

        <section className="stat-grid stat-grid-six module-summary-grid">
          <article className="stat-card">
            <span>Campaign status</span>
            <strong>{progress.status}</strong>
          </article>
          <article className="stat-card">
            <span>Sent</span>
            <strong>{progress.sent}</strong>
          </article>
          <article className="stat-card">
            <span>Failed</span>
            <strong>{progress.failed}</strong>
          </article>
          <article className="stat-card">
            <span>Remaining</span>
            <strong>{progress.remaining}</strong>
          </article>
          <article className="stat-card">
            <span>Suppressions</span>
            <strong>{progress.suppressionCount}</strong>
          </article>
          <article className="stat-card">
            <span>Send rate</span>
            <strong>{progress.sendRate}</strong>
          </article>
        </section>

        <div className="workflow-panels">
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
            id="bareplay-tab-workspace"
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
        </div>
      </div>
    </section>
  );
}
