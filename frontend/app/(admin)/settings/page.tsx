"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Copy, Trash2, Send, AlertTriangle, Key, ExternalLink, RefreshCw } from "lucide-react"
import {
  PageHeader, LoadingState
} from "../../../components/ui"

interface EnrollmentToken {
  id: string
  organization_id: string
  token_hash: string
  created_by: string
  expires_at: string
  created_at: string
}

interface Webhook {
  id: string
  organization_id: string
  name: string
  endpoint_url: string
  enabled: boolean
  events: string[]
  created_at: string
  updated_at: string
  last_delivery_status?: string | null
  last_delivery_at?: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [tokens, setTokens] = useState<EnrollmentToken[]>([])
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Webhook Modal States
  const [showAddWebhook, setShowAddWebhook] = useState(false)
  const [newHookName, setNewHookName] = useState("")
  const [newHookUrl, setNewHookUrl] = useState("")
  const [newHookEvents, setNewHookEvents] = useState<string[]>([
    "VIOLATION_TRIGGERED",
    "VIOLATION_RESOLVED",
    "POLICY_ROLLBACK"
  ])
  const [newHookEnabled, setNewHookEnabled] = useState(true)
  const [savingHook, setSavingHook] = useState(false)
  const [hookError, setHookError] = useState<string | null>(null)

  // One-time Reveal Secret Modal
  const [revealSecret, setRevealSecret] = useState<string | null>(null)
  const [revealHookName, setRevealHookName] = useState<string>("")

  // Webhook Test State
  const [testingHookId, setTestingHookId] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const fetchSettingsData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("flientsec_token")
      if (!token) {
        setError("No active session. Redirecting...")
        return
      }

      // Fetch Enrollment Tokens
      const tokenRes = await fetch(`${apiUrl}/api/v1/enrollment-tokens`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!tokenRes.ok) {
        if (tokenRes.status === 401) {
          localStorage.removeItem("flientsec_token")
          router.push("/login")
          return
        }
        throw new Error("Failed to load enrollment tokens.")
      }
      const tokenData = await tokenRes.json()
      setTokens(tokenData)

      // Fetch Webhooks
      const hookRes = await fetch(`${apiUrl}/api/v1/webhooks`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (hookRes.ok) {
        const hookData = await hookRes.json()
        setWebhooks(hookData)
      }

      setError(null)
    } catch (err: any) {
      setError(err.message || "An error occurred while loading settings.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettingsData()
  }, [apiUrl])

  const handleGenerateToken = async () => {
    try {
      setGenerating(true)
      setError(null)

      const token = localStorage.getItem("flientsec_token")
      if (!token) throw new Error("Session expired. Please log in again.")

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const res = await fetch(`${apiUrl}/api/v1/enrollment-tokens`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          expires_at: expiresAt.toISOString(),
        }),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to generate enrollment token.")
      }

      const newToken = await res.json()
      setTokens((prev) => [newToken, ...prev])
      showToast("Enrollment token generated")
    } catch (err: any) {
      setError(err.message || "Failed to generate enrollment token.")
    } finally {
      setGenerating(false)
    }
  }

  const handleRevokeToken = async (tokenId: string) => {
    if (!confirm("Are you sure you want to revoke this enrollment token? Any installer using it will fail to register new devices.")) {
      return
    }

    try {
      setError(null)
      const token = localStorage.getItem("flientsec_token")
      const res = await fetch(`${apiUrl}/api/v1/enrollment-tokens/${tokenId}/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) throw new Error("Failed to revoke enrollment token.")

      setTokens((prev) => prev.filter((t) => t.id !== tokenId))
      showToast("Token revoked")
    } catch (err: any) {
      setError(err.message || "Failed to revoke enrollment token.")
    }
  }

  // Create Webhook
  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingHook(true)
    setHookError(null)

    try {
      const token = localStorage.getItem("flientsec_token")
      if (!token) throw new Error("Session expired. Please log in again.")

      if (!newHookName.trim() || !newHookUrl.trim()) {
        throw new Error("Webhook name and endpoint URL are required.")
      }

      const res = await fetch(`${apiUrl}/api/v1/webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newHookName.trim(),
          endpoint_url: newHookUrl.trim(),
          events: newHookEvents,
          enabled: newHookEnabled
        })
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to create webhook.")
      }

      const created = await res.json()
      setWebhooks((prev) => [created, ...prev])
      setShowAddWebhook(false)
      setNewHookName("")
      setNewHookUrl("")
      setNewHookEvents(["VIOLATION_TRIGGERED", "VIOLATION_RESOLVED", "POLICY_ROLLBACK"])

      // Open reveal modal
      setRevealHookName(created.name)
      setRevealSecret(created.signing_secret)
    } catch (err: any) {
      setHookError(err.message || "Failed to create webhook.")
    } finally {
      setSavingHook(false)
    }
  }

  // Toggle Webhook Enabled
  const handleToggleWebhook = async (hook: Webhook) => {
    try {
      const token = localStorage.getItem("flientsec_token")
      const updatedEnabled = !hook.enabled

      const res = await fetch(`${apiUrl}/api/v1/webhooks/${hook.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: updatedEnabled })
      })

      if (!res.ok) throw new Error("Failed to update webhook state.")

      setWebhooks((prev) =>
        prev.map((w) => (w.id === hook.id ? { ...w, enabled: updatedEnabled } : w))
      )
      showToast(updatedEnabled ? "Webhook enabled" : "Webhook disabled")
    } catch (err: any) {
      showToast(err.message || "Failed to update webhook.")
    }
  }

  // Test Webhook
  const handleTestWebhook = async (hookId: string) => {
    try {
      setTestingHookId(hookId)
      const token = localStorage.getItem("flientsec_token")

      const res = await fetch(`${apiUrl}/api/v1/webhooks/${hookId}/test`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || "Failed to trigger test delivery.")
      }

      const delivery = await res.json()
      if (delivery.status === "SUCCESS") {
        showToast(`Test delivery succeeded (HTTP ${delivery.response_status_code})`)
      } else {
        showToast(`Test delivery failed: ${delivery.error_message || `HTTP ${delivery.response_status_code}`}`)
      }
      fetchSettingsData()
    } catch (err: any) {
      showToast(err.message || "Test delivery failed.")
    } finally {
      setTestingHookId(null)
    }
  }

  // Delete Webhook
  const handleDeleteWebhook = async (hookId: string) => {
    if (!confirm("Are you sure you want to delete this webhook destination? This cannot be undone.")) {
      return
    }

    try {
      const token = localStorage.getItem("flientsec_token")
      const res = await fetch(`${apiUrl}/api/v1/webhooks/${hookId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) throw new Error("Failed to delete webhook.")

      setWebhooks((prev) => prev.filter((w) => w.id !== hookId))
      showToast("Webhook deleted")
    } catch (err: any) {
      showToast(err.message || "Failed to delete webhook.")
    }
  }

  const copyToClipboard = (text: string, msg: string = "Copied to clipboard") => {
    navigator.clipboard.writeText(text)
    showToast(msg)
  }

  const showToast = (msg: string) => {
    setToastMsg(msg)
    const t = document.getElementById("toast")
    if (t) {
      t.classList.add("show")
      setTimeout(() => t.classList.remove("show"), 2200)
    }
  }

  if (loading) {
    return <LoadingState message="Retrieving configuration settings..." />
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans">
      {/* Page Header */}
      <PageHeader
        title="Settings"
        subtitle="Workstation enrollment, webhooks, and security automation."
      />

      {error && (
        <div className="panel p-5 border border-danger/30 bg-danger/5 text-danger flex items-center justify-between text-sm font-medium">
          <span>{error}</span>
          <button onClick={fetchSettingsData} className="btn btn-sm">Retry</button>
        </div>
      )}

      {/* WEBHOOKS & SECURITY AUTOMATION */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">Outbound Webhooks</div>
            <div className="secondary-text text-xs mt-0.5">
              Send signed HMAC-SHA256 security alerts and policy rollback events to external SIEM/incident systems.
            </div>
          </div>
          <button
            onClick={() => {
              setHookError(null)
              setShowAddWebhook(true)
            }}
            className="btn btn-primary btn-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" style={{ width: "14px", height: "14px", stroke: "currentColor" }}>
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Webhook
          </button>
        </div>

        <div className="table-wrap">
          {webhooks.length === 0 ? (
            <div className="empty">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className="h-6 w-6 text-text-muted mb-3 mx-auto">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <div className="empty-title">No webhooks configured</div>
              <div className="empty-body">Add a webhook endpoint to receive real-time violation and rollback notifications.</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: "22%" }}>Destination</th>
                  <th style={{ width: "32%" }}>Endpoint URL</th>
                  <th style={{ width: "22%" }}>Subscribed Events</th>
                  <th style={{ width: "10%" }}>Status</th>
                  <th style={{ width: "14%", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((w) => (
                  <tr key={w.id}>
                    <td data-label="Destination" className="cell-primary font-medium">
                      {w.name}
                    </td>
                    <td data-label="Endpoint" className="font-mono text-xs text-text-muted truncate max-w-xs">
                      {w.endpoint_url}
                    </td>
                    <td data-label="Events">
                      <div className="flex flex-wrap gap-1">
                        {w.events.map((ev) => (
                          <span key={ev} className="badge badge-neutral text-[10px] px-1.5 py-0.5">
                            {ev === "VIOLATION_TRIGGERED"
                              ? "Triggered"
                              : ev === "VIOLATION_RESOLVED"
                              ? "Resolved"
                              : ev === "POLICY_ROLLBACK"
                              ? "Rollback"
                              : ev}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td data-label="Status">
                      <button
                        onClick={() => handleToggleWebhook(w)}
                        className={`badge cursor-pointer transition-colors ${w.enabled ? "badge-compliant" : "badge-neutral"}`}
                        title="Click to toggle status"
                      >
                        <span className="dot"></span>
                        {w.enabled ? "Active" : "Paused"}
                      </button>
                    </td>
                    <td data-label="Actions" style={{ textAlign: "right" }} className="space-x-1.5">
                      <button
                        onClick={() => handleTestWebhook(w.id)}
                        disabled={testingHookId === w.id}
                        className="btn btn-ghost btn-sm text-xs"
                        title="Dispatch signed test event"
                      >
                        {testingHookId === w.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteWebhook(w.id)}
                        className="btn btn-ghost btn-sm text-xs text-danger hover:bg-danger/10"
                        title="Delete webhook"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ENROLLMENT TOKENS */}
      <div className="section">
        <div className="section-head">
          <div>
            <div className="section-title">Enrollment Tokens</div>
            <div className="secondary-text text-xs mt-0.5">
              Secure single-use tokens required to register new workstations with this organization.
            </div>
          </div>
          <button
            onClick={handleGenerateToken}
            disabled={generating}
            className="btn btn-primary btn-sm"
          >
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" style={{ width: "14px", height: "14px", stroke: "currentColor" }}>
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Generate token
          </button>
        </div>

        <div className="table-wrap">
          {tokens.length === 0 ? (
            <div className="empty">
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" className="h-6 w-6 text-text-muted mb-3 mx-auto">
                <path d="M9 21H5a2 2 0 0 1-2-2V9l4-5h10l4 5v10a2 2 0 0 1-2 2h-4"/>
                <path d="M3 9h18"/>
              </svg>
              <div className="empty-title">No active tokens</div>
              <div className="empty-body">Generate one to enroll a new workstation.</div>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: "35%" }}>Token Hash</th>
                  <th style={{ width: "25%" }}>Created</th>
                  <th style={{ width: "20%" }}>Expires</th>
                  <th style={{ width: "20%", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => {
                  const isExpired = new Date(t.expires_at).getTime() < Date.now()
                  const displayHash = t.token_hash.slice(0, 16) + "..."
                  return (
                    <tr key={t.id}>
                      <td data-label="Token" className="cell-primary font-mono text-xs">
                        {displayHash}
                      </td>
                      <td data-label="Created" className="muted text-xs">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td data-label="Expires">
                        {isExpired ? (
                          <span className="badge badge-neutral" style={{ color: "var(--danger)" }}>Expired</span>
                        ) : (
                          <span className="badge badge-neutral text-xs">
                            {new Date(t.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </td>
                      <td data-label="Actions" style={{ textAlign: "right" }} className="space-x-2">
                        <button
                          onClick={() => copyToClipboard(t.token_hash, "Token copied")}
                          className="btn btn-ghost btn-sm text-xs"
                        >
                          Copy
                        </button>
                        <button
                          onClick={() => handleRevokeToken(t.id)}
                          className="btn btn-ghost btn-sm text-xs text-danger"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* INSTALL THE AGENT */}
      <div className="section">
        <div className="section-head">
          <div className="section-title">Install the agent</div>
        </div>
        <div className="panel">
          <div className="step">
            <div className="step-num">1</div>
            <div>
              <div className="step-title">Generate an enrollment token</div>
              <div className="step-body">Tokens expire after 7 days. Generate one above for each new workstation.</div>
            </div>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <div>
              <div className="step-title">Install the agent</div>
              <div className="step-body">Run this on the target workstation:</div>
              <div
                className="copy-row cursor-pointer group"
                onClick={() => copyToClipboard(`curl -fsSL ${apiUrl}/install.sh | sh`, "Copied installer command")}
              >
                <span>curl -fsSL {apiUrl}/install.sh | sh</span>
                <button className="btn btn-ghost btn-sm copy-btn">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" style={{ width: "14px", height: "14px" }}>
                    <rect x="9" y="9" width="12" height="12" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div className="step" style={{ marginBottom: 0 }}>
            <div className="step-num">3</div>
            <div>
              <div className="step-title">Register with your token</div>
              <div className="step-body">Complete enrollment using the token generated in step 1:</div>
              <div
                className="copy-row cursor-pointer group"
                onClick={() => copyToClipboard(`flientsec-agent enroll --token=<ENROLLMENT_TOKEN>`, "Copied enroll command")}
              >
                <span>flientsec-agent enroll --token=&lt;ENROLLMENT_TOKEN&gt;</span>
                <button className="btn btn-ghost btn-sm copy-btn">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" style={{ width: "14px", height: "14px" }}>
                    <rect x="9" y="9" width="12" height="12" rx="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
              <div className="secondary-text text-xs mt-2">
                Once registered, the workstation appears under <b className="text-text-secondary">Devices</b> within a few seconds.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CREATE WEBHOOK MODAL */}
      {showAddWebhook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="panel max-w-lg w-full p-6 space-y-5 bg-surface-1 border border-border shadow-2xl rounded-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border-soft pb-3">
              <div>
                <h3 className="text-base font-semibold text-text-primary">Add Outbound Webhook</h3>
                <p className="text-xs text-text-muted mt-0.5">Receive signed security events in real time.</p>
              </div>
              <button
                onClick={() => setShowAddWebhook(false)}
                className="text-text-muted hover:text-text-primary text-sm p-1"
              >
                ✕
              </button>
            </div>

            {hookError && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-xs flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{hookError}</span>
              </div>
            )}

            <form onSubmit={handleCreateWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Webhook Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Splunk SIEM Alerting"
                  value={newHookName}
                  onChange={(e) => setNewHookName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1.5">
                  Endpoint URL
                </label>
                <input
                  type="url"
                  placeholder="https://siem.corp.internal/flientsec-webhook"
                  value={newHookUrl}
                  onChange={(e) => setNewHookUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-border rounded-lg text-sm font-mono text-text-primary focus:outline-none focus:border-brand"
                  required
                />
                <p className="text-[11px] text-text-muted mt-1">
                  Must be HTTP or HTTPS. Localhost and private RFC1918 ranges are disallowed.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">
                  Event Subscriptions
                </label>
                <div className="space-y-2 text-xs">
                  {[
                    { id: "VIOLATION_TRIGGERED", label: "VIOLATION_TRIGGERED", desc: "Workstation rule non-compliance detected" },
                    { id: "VIOLATION_RESOLVED", label: "VIOLATION_RESOLVED", desc: "Workstation rule remediated or removed" },
                    { id: "POLICY_ROLLBACK", label: "POLICY_ROLLBACK", desc: "Active fleet security standard rolled back" }
                  ].map((item) => (
                    <label key={item.id} className="flex items-start space-x-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newHookEvents.includes(item.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewHookEvents([...newHookEvents, item.id])
                          } else {
                            setNewHookEvents(newHookEvents.filter((ev) => ev !== item.id))
                          }
                        }}
                        className="mt-0.5 rounded border-border bg-surface-2 text-brand focus:ring-0"
                      />
                      <div>
                        <div className="font-mono text-text-primary font-medium">{item.label}</div>
                        <div className="text-text-muted text-[11px]">{item.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="hookEnabled"
                  checked={newHookEnabled}
                  onChange={(e) => setNewHookEnabled(e.target.checked)}
                  className="rounded border-border bg-surface-2 text-brand focus:ring-0"
                />
                <label htmlFor="hookEnabled" className="text-xs text-text-secondary cursor-pointer">
                  Enable immediately upon creation
                </label>
              </div>

              <div className="flex justify-end space-x-2.5 pt-3 border-t border-border-soft">
                <button
                  type="button"
                  onClick={() => setShowAddWebhook(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingHook}
                  className="btn btn-primary btn-sm"
                >
                  {savingHook ? "Saving..." : "Create Webhook"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVEAL-ONCE SIGNING SECRET MODAL */}
      {revealSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="panel max-w-lg w-full p-6 space-y-4 bg-surface-1 border border-brand/40 shadow-2xl rounded-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-2 text-brand">
              <Key className="h-5 w-5" />
              <h3 className="text-base font-semibold text-text-primary">Webhook Signing Secret</h3>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-xs flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <b>Important:</b> This signing secret will <b>NEVER</b> be shown again. Copy it now and configure your receiver to verify the <code>X-FlientSec-Signature</code> header.
              </span>
            </div>

            <div>
              <div className="text-xs text-text-muted mb-1">Secret for <b>{revealHookName}</b>:</div>
              <div className="flex items-center justify-between p-3 bg-surface-2 border border-border rounded-lg font-mono text-xs text-brand break-all select-all">
                <span>{revealSecret}</span>
                <button
                  onClick={() => copyToClipboard(revealSecret, "Secret copied to clipboard")}
                  className="btn btn-ghost btn-sm shrink-0 ml-2"
                  title="Copy secret"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setRevealSecret(null)}
                className="btn btn-primary btn-sm w-full sm:w-auto"
              >
                I have stored this secret safely
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast popup */}
      <div className="toast" id="toast">
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.5">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
        <span>{toastMsg || "Copied"}</span>
      </div>
    </div>
  )
}
