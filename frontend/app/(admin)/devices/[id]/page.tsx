"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, ShieldAlert, ShieldCheck
} from "lucide-react"
import {
  StatusBadge, ConnectionBadge, LoadingState, EmptyState
} from "../../../../components/ui"

interface Device {
  id: string
  hostname: string
  os_name: string
  os_version: string
  os_arch: string
  kernel_version: string
  agent_version: string
  status: string
  compliance_status: string
  compliance_score: number
  last_checkin: string | null
}

interface Finding {
  id: string
  policy_id: string | null
  rule_id: string
  check_name: string
  severity: string
  status: string
  reason: string | null
  resolution_reason: string | null
  drift_type: string | null
  created_at: string
  first_detected_at: string
  last_detected_at: string
  resolved_at: string | null
}

interface CheckRun {
  id: string
  device_id: string
  timestamp: string
  status: string
  score: number
  policy_version_id: string | null
  content_hash: string | null
  provenance_status: string | null
  policy_name: string | null
  version_number: number | null
}

interface HistoryEvent {
  id: string
  type: string
  rule_name: string
  message: string
  timestamp: string
  finding_id: string | null
  policy_version_id: string | null
}

// Relative time formatter helper
function getRelativeTime(dateString: string | null): string {
  if (!dateString) return "Never"
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) return "Just now"
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return "Just now"
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays === 1) return "Yesterday"
  return `${diffDays}d ago`
}

export default function DeviceDetails() {
  const params = useParams()
  const router = useRouter()
  const deviceId = params.id as string

  const [device, setDevice] = useState<Device | null>(null)
  const [effectivePolicy, setEffectivePolicy] = useState<any>(null)
  const [latestRun, setLatestRun] = useState<CheckRun | null>(null)
  const [openFindings, setOpenFindings] = useState<Finding[]>([])
  const [resolvedFindings, setResolvedFindings] = useState<Finding[]>([])
  const [checkRuns, setCheckRuns] = useState<CheckRun[]>([])
  const [history, setHistory] = useState<HistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<"active" | "resolved">("active")

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem("flientsec_token")
        if (!token) {
          setError("No session active. Redirecting...")
          return
        }
        const headers = { Authorization: `Bearer ${token}` }

        // Fetch Device profile
        const devRes = await fetch(`${apiUrl}/api/v1/devices/${deviceId}`, { headers })
        if (!devRes.ok) {
          if (devRes.status === 401) {
            localStorage.removeItem("flientsec_token")
            window.location.href = "/login"
            return
          }
          throw new Error("Device not found")
        }
        const devData = await devRes.json()
        setDevice(devData)

        // Fetch Effective Policy
        const effPolicyRes = await fetch(`${apiUrl}/api/v1/devices/${deviceId}/effective-policy`, { headers })
        if (effPolicyRes.ok) {
          const effPolicyData = await effPolicyRes.json()
          setEffectivePolicy(effPolicyData)
        }

        // Fetch Latest CheckRun
        const runRes = await fetch(`${apiUrl}/api/v1/devices/${deviceId}/latest-run`, { headers })
        if (runRes.ok) {
          const runData = await runRes.json()
          setLatestRun(runData)
        }

        // Fetch Open Findings
        const openFindingsRes = await fetch(`${apiUrl}/api/v1/devices/${deviceId}/findings?status=OPEN&limit=100`, { headers })
        if (openFindingsRes.ok) {
          const openFindingsData = await openFindingsRes.json()
          setOpenFindings(openFindingsData)
        }

        // Fetch Resolved Findings
        const resolvedFindingsRes = await fetch(`${apiUrl}/api/v1/devices/${deviceId}/findings?status=RESOLVED&limit=100`, { headers })
        if (resolvedFindingsRes.ok) {
          const resolvedFindingsData = await resolvedFindingsRes.json()
          setResolvedFindings(resolvedFindingsData)
        }

        // Fetch Check Runs History
        const checkRunsRes = await fetch(`${apiUrl}/api/v1/devices/${deviceId}/check-runs?limit=30`, { headers })
        if (checkRunsRes.ok) {
          const checkRunsData = await checkRunsRes.json()
          setCheckRuns(checkRunsData)
        }

        // Fetch History Events
        const histRes = await fetch(`${apiUrl}/api/v1/devices/${deviceId}/history`, { headers })
        if (histRes.ok) {
          const histData = await histRes.json()
          setHistory(histData)
        }
        setError(null)
      } catch (err: any) {
        setError(err.message || "Failed to load device details")
      } finally {
        setLoading(false)
      }
    }

    if (deviceId) {
      loadDetails()
    }
  }, [deviceId, apiUrl])

  const handleRevoke = async () => {
    if (!confirm("Are you sure you want to decommission/revoke this device? Once revoked, the agent's token is invalid and no more reports will be accepted.")) {
      return
    }
    try {
      const token = localStorage.getItem("flientsec_token")
      const headers = { Authorization: `Bearer ${token}` }
      const res = await fetch(`${apiUrl}/api/v1/devices/${deviceId}/revoke`, {
        method: "POST",
        headers,
      })
      if (!res.ok) {
        throw new Error("Failed to revoke device")
      }
      const updatedDevice = await res.json()
      setDevice(updatedDevice)
      alert("Device successfully decommissioned/revoked.")
    } catch (err: any) {
      alert(err.message || "Failed to revoke device")
    }
  }

  if (loading) {
    return <LoadingState message="Retrieving workstation security posture..." />
  }

  if (error || !device) {
    return (
      <div className="space-y-4 font-sans text-xs">
        <div className="panel p-5 border border-danger/30 bg-danger/5 text-danger">
          {error || "Workstation profile not found."}
        </div>
        <Link href="/devices" className="btn btn-ghost btn-sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          <span>Back to devices</span>
        </Link>
      </div>
    )
  }

  // Find top active issue if it exists
  const topIssue = openFindings[0] || null

  // Chronologically merge events
  const timelineItems = history.map(item => ({
    id: item.id,
    type: item.type,
    timestamp: item.timestamp,
    message: item.message,
    ruleName: item.rule_name,
  })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const formattedLastSeen = getRelativeTime(device.last_checkin)

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans">

      {/* Back navigation */}
      <div>
        <Link href="/devices" className="btn btn-ghost btn-sm" style={{ marginBottom: "16px" }}>
          <ArrowLeft className="h-4 w-4 inline mr-1" />
          Back to devices
        </Link>
      </div>

      {/* Device Header */}
      <div className="detail-header">
        <div>
          <div className="detail-title-row">
            <div className="detail-title">{device.hostname}</div>
            <ConnectionBadge status={device.status} lastSeen={formattedLastSeen} />
            <StatusBadge status={device.compliance_status} />
          </div>
          <div className="detail-meta">
            <div className="detail-meta-item">UUID <b className="mono select-all">{device.id}</b></div>
            <div className="detail-meta-item">Last check-in <b>{device.last_checkin ? new Date(device.last_checkin).toLocaleString() : "Never"}</b></div>
          </div>
        </div>

        <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: "16px" }}>
          {device.status !== "DECOMMISSIONED" && (
            <button
              onClick={handleRevoke}
              className="btn btn-sm text-danger hover:bg-danger/10 border-danger/25"
            >
              Decommission
            </button>
          )}
          <div>
            <div
              className="stat-value"
              style={{ fontSize: "38px", color: device.compliance_score >= 90 ? "var(--brand)" : device.compliance_score >= 70 ? "var(--warning)" : "var(--danger)" }}
            >
              {device.compliance_score}/100
            </div>
            <div className="section-hint">Compliance score</div>
          </div>
        </div>
      </div>

      {/* Signature Diagnostic Chain */}
      <div className="section">
        <div className="chain">
          <div className="chain-link">
            <div className="chain-eyebrow">Workstation</div>
            <div className="chain-value">{device.hostname}</div>
          </div>
          <div className="chain-link">
            <div className="chain-eyebrow">Status</div>
            <div className="chain-value" style={{ color: device.compliance_status === "PASS" ? "var(--brand)" : device.compliance_status === "WARN" ? "var(--warning)" : "var(--danger)" }}>
              {device.compliance_status === "PASS" ? "Compliant" : device.compliance_status === "WARN" ? "Warning" : "Failing"} · {device.compliance_score}/100
            </div>
          </div>
          <div className="chain-link">
            <div className="chain-eyebrow">Top issue</div>
            <div className="chain-value truncate">{topIssue ? topIssue.check_name : "None"}</div>
          </div>
          <div className="chain-link">
            <div className="chain-eyebrow">Severity</div>
            <div className="chain-value" style={{ color: topIssue?.severity === "HIGH" ? "var(--danger)" : topIssue?.severity === "MEDIUM" ? "var(--warning)" : "inherit" }}>
              {topIssue ? topIssue.severity : "—"}
            </div>
          </div>
          <div className="chain-link">
            <div className="chain-eyebrow">Classification</div>
            <div className="chain-value mono">{topIssue ? (topIssue.drift_type || "DEVICE_DRIFT") : "—"}</div>
          </div>
          <div className="chain-link">
            <div className="chain-eyebrow">Policy</div>
            <div className="chain-value mono truncate">
              {latestRun?.policy_name || "Baseline"} v{latestRun?.version_number || "?"}
            </div>
          </div>
          <div className="chain-link">
            <div className="chain-eyebrow">Action</div>
            <div className="chain-value" style={{ color: topIssue ? "var(--danger)" : "var(--brand)" }}>
              {topIssue ? "Remediation required" : "No action needed"}
            </div>
          </div>
        </div>
      </div>

      {/* Device Information */}
      <div className="section">
        <div className="section-head"><div className="section-title">Device information</div></div>
        <div className="info-grid">
          <div className="info-cell">
            <div className="info-label">Operating system</div>
            <div className="info-value">{device.os_name} {device.os_version}</div>
          </div>
          <div className="info-cell">
            <div className="info-label">Architecture</div>
            <div className="info-value">{device.os_arch}</div>
          </div>
          <div className="info-cell">
            <div className="info-label">Kernel</div>
            <div className="info-value truncate">{device.kernel_version}</div>
          </div>
          <div className="info-cell">
            <div className="info-label">Agent version</div>
            <div className="info-value">{device.agent_version}</div>
          </div>
        </div>
      </div>

      {/* Policy Alignment */}
      <div className="section">
        <div className="section-head"><div className="section-title">Policy alignment</div></div>
        <div className="align-panel">
          <div className="align-cell">
            <div className="align-label">Desired policy</div>
            <div className="align-value">{effectivePolicy ? `${effectivePolicy.name} v${effectivePolicy.active_version_number || "Draft"}` : "None Assigned"}</div>
          </div>
          <div className="align-arrow">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </div>
          <div className="align-cell">
            <div className="align-label">Last evaluated</div>
            <div className="align-value">{latestRun?.policy_name || "Baseline"} v{latestRun?.version_number || "?"}</div>
          </div>
          <div className="align-arrow">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </div>
          <div className="align-cell">
            <div className="align-label">Status</div>
            <div className="align-value" style={{ color: latestRun?.provenance_status === "CURRENT" ? "var(--success)" : "var(--warning)" }}>
              {latestRun?.provenance_status === "CURRENT" ? "Up to date" : "Update pending"}
            </div>
          </div>
        </div>
      </div>

      {/* Findings Section */}
      <div className="section">
        <div className="tabs">
          <div
            onClick={() => setActiveTab("active")}
            className={`tab ${activeTab === "active" ? "active" : ""}`}
          >
            Active findings
          </div>
          <div
            onClick={() => setActiveTab("resolved")}
            className={`tab ${activeTab === "resolved" ? "active" : ""}`}
          >
            Resolved
          </div>
        </div>

        <div className="table-wrap">
          {activeTab === "active" ? (
            openFindings.length === 0 ? (
              <div className="empty">
                <ShieldCheck className="h-6 w-6 text-text-muted mb-3 mx-auto" />
                <div className="empty-title">No active findings</div>
                <div className="empty-body">This workstation currently satisfies its assigned policy.</div>
              </div>
            ) : (
              <table>
                <tbody>
                  {openFindings.map((finding) => (
                    <tr key={finding.id}>
                      <td data-label="Finding" style={{ width: "38%" }}>
                        <div className="cell-primary">{finding.check_name}</div>
                        <div className="cell-sub mono">{finding.rule_id}</div>
                      </td>
                      <td data-label="Severity">
                        <span className={`sev ${finding.severity.toUpperCase() === 'HIGH' ? 'sev-high' : finding.severity.toUpperCase() === 'MEDIUM' ? 'sev-medium' : 'sev-low'}`}>
                          {finding.severity}
                        </span>
                      </td>
                      <td data-label="Classification">
                        <span className={`class-pill ${finding.drift_type === "POLICY_CHANGE_NON_COMPLIANCE" ? "policy" : "drift"}`}>
                          {finding.drift_type === "POLICY_CHANGE_NON_COMPLIANCE" ? "Policy change" : "Device drift"}
                        </span>
                      </td>
                      <td data-label="Detected" className="muted">
                        {getRelativeTime(finding.first_detected_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            resolvedFindings.length === 0 ? (
              <div className="empty">
                <ShieldCheck className="h-6 w-6 text-text-muted mb-3 mx-auto" />
                <div className="empty-title">Nothing resolved yet</div>
              </div>
            ) : (
              <table>
                <tbody>
                  {resolvedFindings.map((finding) => (
                    <tr key={finding.id}>
                      <td data-label="Finding" style={{ width: "38%" }}>
                        <div className="cell-primary">{finding.check_name}</div>
                        <div className="cell-sub mono">{finding.rule_id}</div>
                      </td>
                      <td data-label="Severity">
                        <span className={`sev ${finding.severity.toUpperCase() === 'HIGH' ? 'sev-high' : finding.severity.toUpperCase() === 'MEDIUM' ? 'sev-medium' : 'sev-low'}`}>
                          {finding.severity}
                        </span>
                      </td>
                      <td data-label="Resolution">
                        <span className="badge badge-neutral">{finding.resolution_reason || "REMEDIATED"}</span>
                      </td>
                      <td data-label="Resolved" className="muted">
                        {getRelativeTime(finding.resolved_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      </div>

      {/* Security Timeline */}
      <div className="section">
        <div className="section-head"><div className="section-title">Security timeline</div></div>
        <div className="panel">
          {timelineItems.length === 0 ? (
            <div className="empty">
              <ShieldCheck className="h-6 w-6 text-text-muted mb-3 mx-auto" />
              <div className="empty-title">No activity yet</div>
            </div>
          ) : (
            <div className="timeline">
              {timelineItems.map((item) => {
                const isTrigger = item.type === "VIOLATION_TRIGGERED"
                return (
                  <div key={item.id} className="tl-item">
                    <div className={`tl-dot ${isTrigger ? "trigger" : "resolve"}`}></div>
                    <div className="tl-title">
                      {isTrigger ? "Violation triggered" : "Violation resolved"}
                    </div>
                    <div className="tl-detail">{item.message}</div>
                    <div className="tl-meta">
                      Rule <span className="mono">{item.ruleName}</span> · {getRelativeTime(item.timestamp)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Technical Evidence */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-head"><div className="section-title">Technical evidence</div></div>
        <div className="evidence">
          <div><span className="k">content_hash</span>&nbsp;&nbsp;{latestRun?.content_hash || "—"}</div>
          <div><span className="k">agent_version</span>&nbsp;&nbsp;{device.agent_version}</div>
          <div><span className="k">last_check_run</span>&nbsp;&nbsp;{latestRun?.timestamp ? getRelativeTime(latestRun.timestamp) : "—"}</div>
          <div><span className="k">policy_provenance</span>&nbsp;&nbsp;{latestRun?.provenance_status || "—"}</div>
        </div>
      </div>
    </div>
  )
}
