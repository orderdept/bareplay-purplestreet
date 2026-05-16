"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { type CampaignContact, type CampaignDraft } from "../../lib/bareplay-types";
import { HostedSendActions } from "./hosted-send-actions";

type Props = {
  draft: CampaignDraft;
  suppressions: string[];
  templateName?: string | null;
};

type DraftContact = CampaignContact & {
  source: "csv" | "typed";
  sourceIndex: number;
  status: "ready" | "duplicate" | "suppressed";
};

const defaultContactName = "BarePlay Members";
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const keychainHelperUrl = "http://127.0.0.1:8787";

function normalizeEmail(value: string) {
  const match = String(value || "").match(emailPattern);
  return match ? match[0].trim().toLowerCase() : "";
}

function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (cell || row.length) {
        row.push(cell.trim());
        rows.push(row);
        row = [];
        cell = "";
      }
      if (char === "\r" && next === "\n") {
        index += 1;
      }
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((item) => item.some(Boolean));
}

function contactsFromCsv(text: string) {
  const rows = csvRows(text);
  if (!rows.length) return [];

  const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  const emailIndex = headers.findIndex((header) => ["email", "email_address", "e_mail"].includes(header));
  const nameIndex = headers.findIndex((header) => ["name", "first_name", "customer", "customer_name"].includes(header));
  const dataRows = emailIndex >= 0 ? rows.slice(1) : rows;

  return dataRows
    .map((row) => {
      const email = normalizeEmail(emailIndex >= 0 ? row[emailIndex] || "" : row.join(" "));
      const name = nameIndex >= 0 ? row[nameIndex] || "" : "";
      return email ? { email, name: name || defaultContactName } : null;
    })
    .filter((item): item is CampaignContact => Boolean(item));
}

function contactsFromPaste(text: string) {
  const contacts: CampaignContact[] = [];
  String(text || "")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const email = normalizeEmail(trimmed);
      if (!email) return;

      const emailIndex = trimmed.toLowerCase().indexOf(email);
      const beforeEmail = emailIndex >= 0 ? trimmed.slice(0, emailIndex) : "";
      const name = beforeEmail
        .replace(/[<,;:"'\s]+$/g, "")
        .replace(/^["']|["']$/g, "")
        .trim();

      contacts.push({ email, name: name || defaultContactName });
    });
  return contacts;
}

function intervalMs(draft: CampaignDraft) {
  const dailyLimit = Math.max(1, Number(draft.dailyLimit || 250));
  const perSecond = Math.max(1, Math.min(5, Number(draft.perSecond || 1)));
  if (draft.spacingMode === "rate") return Math.ceil(1000 / perSecond);
  return Math.ceil((24 * 60 * 60 * 1000) / dailyLimit);
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) {
    const seconds = ms / 1000;
    return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
  }
  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function formatDraftCompletion(readyCount: number, spacing: number) {
  if (!readyCount) return "—";
  return new Date(Date.now() + Math.max(0, readyCount - 1) * spacing).toLocaleString();
}

export function CampaignWorkspace({ draft: initialDraft, suppressions, templateName }: Props) {
  const [draft, setDraft] = useState<CampaignDraft>(initialDraft);
  const [csvContacts, setCsvContacts] = useState<CampaignContact[]>(initialDraft.csvContacts);
  const [typedContacts, setTypedContacts] = useState<CampaignContact[]>(initialDraft.typedContacts);
  const [pasteText, setPasteText] = useState(initialDraft.pasteText);
  const [csvImportMode, setCsvImportMode] = useState<"replace" | "add">("replace");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [keychainStatus, setKeychainStatus] = useState("Checking Mac Keychain...");
  const [saveStatus, setSaveStatus] = useState("Save your audience and delivery settings so the campaign is ready when you come back.");
  const [deliveryStatus, setDeliveryStatus] = useState("Add the mailbox password, then run the sender login check.");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const suppressionsSet = useMemo(() => new Set(suppressions), [suppressions]);
  const contacts = useMemo(() => {
    const seen = new Set<string>();
    const draftContacts: Omit<DraftContact, "status">[] = [
      ...csvContacts.map((contact, sourceIndex) => ({ ...contact, source: "csv" as const, sourceIndex })),
      ...typedContacts.map((contact, sourceIndex) => ({ ...contact, source: "typed" as const, sourceIndex })),
    ];

    return draftContacts.map<DraftContact>((contact) => {
      if (suppressionsSet.has(contact.email)) {
        return { ...contact, status: "suppressed" };
      }
      if (seen.has(contact.email)) {
        return { ...contact, status: "duplicate" };
      }
      seen.add(contact.email);
      return { ...contact, status: "ready" };
    });
  }, [csvContacts, suppressionsSet, typedContacts]);

  const counts = useMemo(() => {
    const ready = contacts.filter((contact) => contact.status === "ready").length;
    const duplicate = contacts.filter((contact) => contact.status === "duplicate").length;
    const suppressedCount = contacts.filter((contact) => contact.status === "suppressed").length;
    const spacing = intervalMs(draft);
    return {
      ready,
      duplicate,
      suppressedCount,
      spacing,
      window: formatDuration(Math.max(0, ready - 1) * spacing),
      completion: formatDraftCompletion(ready, spacing),
    };
  }, [contacts, draft]);

  async function saveSetup(
    nextDraft = draft,
    nextCsvContacts = csvContacts,
    nextTypedContacts = typedContacts,
    nextPasteText = pasteText,
    setStatus: (message: string) => void = setSaveStatus,
  ) {
    setSaving(true);
    setStatus("Saving the campaign setup...");
    try {
      const response = await fetch("/api/bareplay/campaign-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...nextDraft,
          campaignName: nextDraft.campaignName,
          draftMessageName: nextDraft.draftMessageName,
          messageSubject: nextDraft.messageSubject,
          messagePreviewText: nextDraft.messagePreviewText,
          messageBody: nextDraft.messageBody,
          messageMailingAddress: nextDraft.messageMailingAddress,
          csvContacts: nextCsvContacts,
          typedContacts: nextTypedContacts,
          pasteText: nextPasteText,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Could not save the campaign setup.");
      }
      setStatus(`Saved ${data.contactCount || 0} contacts to BarePlay.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save the campaign setup.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDeliverySettings() {
    await saveSetup(draft, csvContacts, typedContacts, pasteText, (message) => {
      setDeliveryStatus(
        smtpPassword.trim()
          ? `${message} Password is ready for login/test in this browser session.`
          : `${message} Add the mailbox password before checking login.`,
      );
    });
  }

  async function handleCsvChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const importedContacts = contactsFromCsv(await file.text());
    const nextCsvContacts = csvImportMode === "add" ? [...csvContacts, ...importedContacts] : importedContacts;
    setCsvContacts(nextCsvContacts);
    await saveSetup(draft, nextCsvContacts, typedContacts, pasteText);
  }

  async function handlePasteChange(value: string) {
    const nextTypedContacts = contactsFromPaste(value);
    setPasteText(value);
    setTypedContacts(nextTypedContacts);
  }

  async function handleClearList() {
    setCsvContacts([]);
    setTypedContacts([]);
    setPasteText("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    await saveSetup(draft, [], [], "");
  }

  function handleContactEdit(source: DraftContact["source"], sourceIndex: number, field: keyof CampaignContact, value: string) {
    const nextValue = field === "email" ? value.trim().toLowerCase() : value;
    const updateContact = (contact: CampaignContact, index: number) =>
      index === sourceIndex ? { ...contact, [field]: nextValue } : contact;

    if (source === "csv") {
      setCsvContacts((current) => current.map(updateContact));
    } else {
      setTypedContacts((current) => current.map(updateContact));
    }
    setSaveStatus("Recipient updated. Save setup when you're ready.");
  }

  async function handleContactEditBlur() {
    await saveSetup(draft, csvContacts, typedContacts, pasteText, () => {
      setSaveStatus("Recipient edit saved to BarePlay.");
    });
  }


  const visibleRows = contacts.slice(0, 300);

  useEffect(() => {
    if (smtpPassword.trim()) {
      window.sessionStorage.setItem("bareplay-email-password", smtpPassword);
    } else {
      window.sessionStorage.removeItem("bareplay-email-password");
    }
  }, [smtpPassword]);

  useEffect(() => {
    let ignore = false;

    async function loadSavedPassword() {
      try {
        const statusResponse = await fetch(`${keychainHelperUrl}/status?username=${encodeURIComponent(draft.smtpUsername)}`);
        const statusData = (await statusResponse.json()) as { hasPassword?: boolean };
        if (ignore) return;

        if (!statusData.hasPassword) {
          setKeychainStatus("Mac Keychain helper is running. No saved password found for this sender yet.");
          return;
        }

        const loadResponse = await fetch(`${keychainHelperUrl}/load`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: draft.smtpUsername }),
        });
        const loadData = (await loadResponse.json().catch(() => ({}))) as { password?: string };
        if (ignore) return;

        if (loadResponse.ok && loadData.password) {
          setSmtpPassword(loadData.password);
          setKeychainStatus("Saved Mac Keychain password is ready for this session.");
          setDeliveryStatus("Saved Mac Keychain password is ready. Run the sender login check when ready.");
        } else {
          setKeychainStatus("Mac Keychain has a saved item, but it could not be loaded.");
        }
      } catch {
        if (!ignore) {
          setKeychainStatus("Mac Keychain helper is not running on this Mac.");
        }
      }
    }

    void loadSavedPassword();
    return () => {
      ignore = true;
    };
  }, [draft.smtpUsername]);

  async function savePasswordToKeychain() {
    if (!smtpPassword.trim()) {
      setKeychainStatus("Enter the mailbox password first, then save it to Mac Keychain.");
      return;
    }
    setKeychainStatus("Saving password to Mac Keychain...");
    try {
      const response = await fetch(`${keychainHelperUrl}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: draft.smtpUsername, password: smtpPassword }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Could not save the password to Mac Keychain.");
      }
      setKeychainStatus("Password saved to Mac Keychain for this sender.");
    } catch (error) {
      setKeychainStatus(error instanceof Error ? error.message : "Mac Keychain helper is not running on this Mac.");
    }
  }

  return (
    <section className="workflow-stack">
      <article className="panel wide">
        <div className="section-head">
          <div>
            <p className="section-step">Step 2</p>
            <h2>Build the audience</h2>
            <p>Upload a CSV, paste addresses, or combine both. The list is cleaned as it comes in so you can see what is truly ready.</p>
          </div>
          <div className="button-row">
            <button className="action-link ghost button-like" disabled={saving} onClick={() => void saveSetup()} type="button">
              Save setup
            </button>
            <button className="action-link ghost button-like" disabled={saving} onClick={() => void handleClearList()} type="button">
              Clear list
            </button>
          </div>
        </div>

        <div className="workflow-summary-bar">
          <div className="workflow-summary-item">
            <span>Ready</span>
            <strong>{counts.ready.toLocaleString()}</strong>
          </div>
          <div className="workflow-summary-item">
            <span>Duplicates</span>
            <strong>{counts.duplicate.toLocaleString()}</strong>
          </div>
          <div className="workflow-summary-item">
            <span>Suppressed</span>
            <strong>{counts.suppressedCount.toLocaleString()}</strong>
          </div>
          <div className="workflow-summary-item">
            <span>Send window</span>
            <strong>{counts.window}</strong>
          </div>
        </div>

        <div className="host-form-grid">
          <label className="field">
            <span>Upload CSV</span>
            <input ref={fileInputRef} accept=".csv,.txt" onChange={handleCsvChange} type="file" />
            <span className="segmented-control" role="radiogroup" aria-label="CSV import mode">
              <label>
                <input
                  checked={csvImportMode === "replace"}
                  name="csv-import-mode"
                  onChange={() => setCsvImportMode("replace")}
                  type="radio"
                />
                Replace list
              </label>
              <label>
                <input
                  checked={csvImportMode === "add"}
                  name="csv-import-mode"
                  onChange={() => setCsvImportMode("add")}
                  type="radio"
                />
                Add to existing list
              </label>
            </span>
          </label>
          <label className="field">
            <span>Paste email addresses</span>
            <textarea
              onChange={(event) => void handlePasteChange(event.target.value)}
              placeholder={"customer@example.com\nJane Customer <jane@example.com>\nJane Customer, jane@example.com"}
              rows={8}
              value={pasteText}
            />
          </label>
        </div>

        <small className="template-status">{saveStatus}</small>

        <details className="recipient-panel top-gap">
          <summary>
            <span>
              Recipient list
              <strong>{contacts.length.toLocaleString()} total</strong>
            </span>
            <span className="recipient-panel-action">Open list</span>
          </summary>
          <div className="table-wrap recipient-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length ? (
                  visibleRows.map((contact) => (
                    <tr key={`${contact.source}-${contact.sourceIndex}`}>
                      <td>
                        <input
                          aria-label="Recipient email"
                          className="recipient-edit-input"
                          onBlur={() => void handleContactEditBlur()}
                          onChange={(event) => handleContactEdit(contact.source, contact.sourceIndex, "email", event.target.value)}
                          value={contact.email}
                        />
                      </td>
                      <td>
                        <input
                          aria-label="Recipient name"
                          className="recipient-edit-input"
                          onBlur={() => void handleContactEditBlur()}
                          onChange={(event) => handleContactEdit(contact.source, contact.sourceIndex, "name", event.target.value)}
                          value={contact.name || ""}
                        />
                      </td>
                      <td>
                        <span className={`status-chip ${contact.status}`}>{contact.status}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>No contacts loaded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {contacts.length > visibleRows.length ? (
            <small className="template-status">Showing the first {visibleRows.length.toLocaleString()} recipients.</small>
          ) : null}
        </details>
      </article>

      <div className="split-grid">
        <article className="panel">
          <div className="section-head">
            <div>
              <p className="section-step">Step 3</p>
              <h2>Set delivery rules</h2>
              <p>Keep the sender identity, pacing, and cap aligned with how BarePlay should send.</p>
            </div>
          </div>

          <div className="host-form-grid">
            <label className="field">
              <span>SMTP host</span>
              <input
                onChange={(event) => setDraft((current) => ({ ...current, smtpHost: event.target.value }))}
                value={draft.smtpHost}
              />
            </label>
            <label className="field">
              <span>Port</span>
              <input
                min={1}
                onChange={(event) => setDraft((current) => ({ ...current, smtpPort: Number(event.target.value || 465) }))}
                type="number"
                value={draft.smtpPort}
              />
            </label>
            <label className="field">
              <span>Security</span>
              <select
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    smtpSecurity: event.target.value === "starttls" ? "starttls" : "ssl",
                  }))
                }
                value={draft.smtpSecurity}
              >
                <option value="ssl">SSL/TLS</option>
                <option value="starttls">STARTTLS</option>
              </select>
            </label>
            <label className="field">
              <span>Sender</span>
              <input
                onChange={(event) => setDraft((current) => ({ ...current, smtpUsername: event.target.value }))}
                type="email"
                value={draft.smtpUsername}
              />
              <small>This is the mailbox used for SMTP login and the From address.</small>
            </label>
            <label className="field">
              <span>Email password</span>
              <input
                autoComplete="current-password"
                onChange={(event) => setSmtpPassword(event.target.value)}
                type="password"
                value={smtpPassword}
              />
              <small>Used for login/test in this browser session. A saved Mac Keychain password loads automatically.</small>
            </label>
            <div className="field keychain-field">
              <span>Mac Keychain</span>
              <button className="action-link ghost button-like" onClick={() => void savePasswordToKeychain()} type="button">
                Save to Mac Keychain
              </button>
              <small>{keychainStatus}</small>
            </div>
            <label className="field">
              <span>From name</span>
              <input
                onChange={(event) => setDraft((current) => ({ ...current, fromName: event.target.value }))}
                value={draft.fromName}
              />
            </label>
            <label className="field">
              <span>Daily campaign cap</span>
              <input
                min={1}
                onChange={(event) => setDraft((current) => ({ ...current, dailyLimit: Number(event.target.value || 800) }))}
                type="number"
                value={draft.dailyLimit}
              />
            </label>
            <label className="field">
              <span>Max messages per second</span>
              <input
                max={5}
                min={1}
                onChange={(event) => setDraft((current) => ({ ...current, perSecond: Number(event.target.value || 3) }))}
                type="number"
                value={draft.perSecond}
              />
            </label>
            <label className="field">
              <span>Spacing mode</span>
              <select
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    spacingMode: event.target.value === "daily" ? "daily" : "rate",
                  }))
                }
                value={draft.spacingMode}
              >
                <option value="rate">Use per-second cap</option>
                <option value="daily">Evenly across daily cap</option>
              </select>
            </label>
          </div>

          <div className="button-row">
            <button className="action-link button-like" disabled={saving} onClick={() => void saveDeliverySettings()} type="button">
              Save settings
            </button>
          </div>
          <p className="inline-status">{deliveryStatus}</p>
        </article>

        <article className="panel">
          <div className="section-head">
            <div>
              <p className="section-step">Step 4</p>
              <h2>Run a final check</h2>
              <p>Make sure the timing feels right, then verify login and send a live test.</p>
            </div>
          </div>

          <div className="checklist-block">
            <div className="checklist-row">
              <span>Ready to send</span>
              <strong>{counts.ready.toLocaleString()} contacts</strong>
            </div>
            <div className="checklist-row">
              <span>Next send interval</span>
              <strong>{formatDuration(counts.spacing)}</strong>
            </div>
            <div className="checklist-row">
              <span>Projected completion</span>
              <strong>{counts.completion}</strong>
            </div>
            <div className="checklist-row">
              <span>Saved template</span>
              <strong>{templateName || "No message saved yet"}</strong>
            </div>
          </div>

          <HostedSendActions readyCount={counts.ready} smtpPassword={smtpPassword} templateName={templateName} />
          <p className="quiet-note">
            Use the login check first if anything looks off, then send a live test before the full campaign run.
          </p>
        </article>
      </div>
    </section>
  );
}
