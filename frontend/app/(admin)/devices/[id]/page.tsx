"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, ShieldCheck, X, Copy, Check, FileCheck, Layers, ExternalLink
} from "lucide-react"
import {
  StatusBadge, ConnectionBadge, LoadingState, SeverityBadge
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
  severity: "HIGH" | "MEDIUM" | "LOW"
  status: "OPEN" | "RESOLVED"
  reason: string | null
  resolution_reason: string | null
  drift_type: "DEVICE_DRIFT" | "POLICY_CHANGE_NON_COMPLIANCE" | null
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

interface DeviceControlStatus {
  control_id: string
  name: string
  category: string
  severity: string
  mapped_rule_id: string
  status: string
  last_evaluated_at: string | null
  observed_result: string | null
}

interface DeviceCompliance {
  device_id: string
  hostname: string
  compliance_score: number
  compliance_status: string
  last_evaluated_at: string | null
  controls: DeviceControlStatus[]
}

interface EvidenceItem {
  id: string
  organization_id: string
  device_id: string
  hostname: string
  control_id: string
  rule_id: string
  check_run_id: string | null
  policy_version_id: string | null
  status: string
  severity: string
  observed_result: string
  evaluation_timestamp: string
  evidence_hash: string
  created_at: string
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
  const [deviceCompliance, setDeviceCompliance] = useState<DeviceCompliance | null>(null)
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<"active" | "resolved" | "controls" | "evidence">("active")

  // Finding inspection drawer states
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

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

        // Fetch Device Compliance Posture
        const compRes = await fetch(`${apiUrl}/api/v1/devices/${deviceId}/compliance`, { headers })
        if (compRes.ok) {
          const compData = await compRes.json()
          setDeviceCompliance(compData)
        }

        // Fetch Device Evidence Records
        const evRes = await fetch(`${apiUrl}/api/v1/devices/${deviceId}/evidence?limit=50`, { headers })
        if (evRes.ok) {
          const evData = await evRes.json()
          setEvidenceList(evData.items || [])
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

  // Keyboard Escape listener to dismiss Drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

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

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedHash(id)
    setTimeout(() => setCopiedHash(null), 2000)
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

  const handleRowClick = (finding: Finding) => {
    setSelectedFinding(finding)
    setDrawerOpen(true)
  }

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
            <div className="chain-value" title={device.hostname}>{device.hostname}</div>
          </div>
          <div className="chain-link">
            <div className="chain-eyebrow">Status</div>
            <div className="chain-value" style={{ color: device.compliance_status === "PASS" ? "var(--brand)" : device.compliance_status === "WARN" ? "var(--warning)" : "var(--danger)" }}>
              {device.compliance_status === "PASS" ? "Compliant" : device.compliance_status === "WARN" ? "Warning" : "Failing"} · {device.compliance_score}/100
            </div>
          </div>
          <div className="chain-link">
            <div className="chain-eyebrow">Top issue</div>
            <div className="chain-value" title={topIssue ? topIssue.check_name : "None"}>{topIssue ? topIssue.check_name : "None"}</div>
          </div>
          <div className="chain-link">
            <div className="chain-eyebrow">Severity</div>
            <div className="chain-value" style={{ color: topIssue?.severity === "HIGH" ? "var(--danger)" : topIssue?.severity === "MEDIUM" ? "var(--warning)" : "inherit" }}>
              {topIssue ? topIssue.severity : "—"}
            </div>
          </div>
          <div className="chain-link">
            <div className="chain-eyebrow">Classification</div>
            <div className="chain-value" title={topIssue?.drift_type || "None"}>
              {topIssue?.drift_type === "POLICY_CHANGE_NON_COMPLIANCE"
                ? "Policy change"
                : topIssue?.drift_type === "DEVICE_DRIFT"
                ? "Device drift"
                : topIssue ? "Drift" : "—"}
            </div>
          </div>
          <div className="chain-link">
            <div className="chain-eyebrow">Policy</div>
            <div className="chain-value mono" title={`${latestRun?.policy_name || effectivePolicy?.name || "Baseline"} v${latestRun?.version_number || effectivePolicy?.active_version_number || 1}`}>
              {latestRun?.policy_name || effectivePolicy?.name || "Baseline"} v{latestRun?.version_number || effectivePolicy?.active_version_number || 1}
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
            <div className="info-label">Architecture / Kernel</div>
            <div className="info-value mono">{device.os_arch} · {device.kernel_version}</div>
          </div>
          <div className="info-cell">
            <div className="info-label">Agent version</div>
            <div className="info-value mono">{device.agent_version}</div>
          </div>
          <div className="info-cell">
            <div className="info-label">Active policy</div>
            <div className="info-value mono">{effectivePolicy?.name || effectivePolicy?.policy_name || "Baseline"}</div>
          </div>
        </div>
      </div>

      {/* Provenance Alignment Section */}
      <div className="section">
        <div className="section-head"><div className="section-title">Provenance alignment</div></div>
        <div className="align-panel">
          <div className="align-cell">
            <div className="align-label">Assigned version</div>
            <div className="align-value mono" title={effectivePolicy ? `v${effectivePolicy.active_version_number ?? effectivePolicy.version_number ?? 1} (${effectivePolicy.name || effectivePolicy.policy_name || "Baseline"})` : "Not assigned"}>
              {effectivePolicy ? `v${effectivePolicy.active_version_number ?? effectivePolicy.version_number ?? 1} (${effectivePolicy.name || effectivePolicy.policy_name || "Baseline"})` : "Not assigned"}
            </div>
          </div>
          <div className="align-arrow">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </div>
          <div className="align-cell">
            <div className="align-label">Reported version</div>
            <div className="align-value mono">
              {latestRun?.version_number ? `v${latestRun.version_number}` : "None"}
            </div>
          </div>
          <div className="align-arrow">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </div>
          <div className="align-cell">
            <div className="align-label">Status</div>
            <div className="align-value" style={{ color: latestRun?.provenance_status === "CURRENT" ? "var(--success)" : "var(--warning)" }}>
              {latestRun?.provenance_status === "CURRENT" ? "Up to date" : "Update pending"}
            </div>
          </div>
        </div>
      </div>

      {/* Posture & Findings Tabs Section */}
      <div className="section">
        <div className="tabs">
          <div
            onClick={() => setActiveTab("active")}
            className={`tab ${activeTab === "active" ? "active" : ""}`}
          >
            Active findings ({openFindings.length})
          </div>
          <div
            onClick={() => setActiveTab("resolved")}
            className={`tab ${activeTab === "resolved" ? "active" : ""}`}
          >
            Resolved ({resolvedFindings.length})
          </div>
          <div
            onClick={() => setActiveTab("controls")}
            className={`tab ${activeTab === "controls" ? "active" : ""}`}
          >
            Compliance Controls ({deviceCompliance?.controls.length || 0})
          </div>
          <div
            onClick={() => setActiveTab("evidence")}
            className={`tab ${activeTab === "evidence" ? "active" : ""}`}
          >
            Audit Evidence ({evidenceList.length})
          </div>
        </div>

        <div className="table-wrap">
          {activeTab === "active" && (
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
                    <tr
                      key={finding.id}
                      onClick={() => handleRowClick(finding)}
                      className="clickable"
                    >
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
          )}

          {activeTab === "resolved" && (
            resolvedFindings.length === 0 ? (
              <div className="empty">
                <ShieldCheck className="h-6 w-6 text-text-muted mb-3 mx-auto" />
                <div className="empty-title">Nothing resolved yet</div>
              </div>
            ) : (
              <table>
                <tbody>
                  {resolvedFindings.map((finding) => (
                    <tr
                      key={finding.id}
                      onClick={() => handleRowClick(finding)}
                      className="clickable"
                    >
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

          {activeTab === "controls" && (
            !deviceCompliance || deviceCompliance.controls.length === 0 ? (
              <div className="empty">
                <Layers className="h-6 w-6 text-text-muted mb-3 mx-auto" />
                <div className="empty-title">No compliance controls mapped</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Control ID</th>
                    <th>Control Name</th>
                    <th>Category</th>
                    <th>Severity</th>
                    <th>Observed State</th>
                    <th>Status</th>
                    <th>Evaluated</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceCompliance.controls.map((ctrl) => (
                    <tr key={ctrl.control_id}>
                      <td className="font-mono font-bold text-xs text-brand">{ctrl.control_id}</td>
                      <td>
                        <div className="font-semibold text-xs text-text-primary">{ctrl.name}</div>
                        <div className="text-[11px] font-mono text-text-muted">{ctrl.mapped_rule_id}</div>
                      </td>
                      <td className="text-xs text-text-secondary">{ctrl.category}</td>
                      <td><SeverityBadge severity={ctrl.severity} /></td>
                      <td className="font-mono text-[11px] text-text-muted truncate max-w-xs" title={ctrl.observed_result || ""}>
                        {ctrl.observed_result || "—"}
                      </td>
                      <td>
                        <span className={`badge ${ctrl.status === "PASS" ? "badge-compliant" : ctrl.status === "FAIL" ? "badge-failing" : "badge-neutral"}`}>
                          <span className="dot"></span>
                          {ctrl.status}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-text-muted">
                        {getRelativeTime(ctrl.last_evaluated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {activeTab === "evidence" && (
            evidenceList.length === 0 ? (
              <div className="empty">
                <FileCheck className="h-6 w-6 text-text-muted mb-3 mx-auto" />
                <div className="empty-title">No audit evidence records yet</div>
                <div className="empty-body">Check-in telemetry creates immutable, hashed evidence.</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Evaluation Time</th>
                    <th>Control ID</th>
                    <th>Rule ID</th>
                    <th>Status</th>
                    <th>Severity</th>
                    <th>Observed Result</th>
                    <th>Evidence SHA-256 Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {evidenceList.map((ev) => (
                    <tr key={ev.id}>
                      <td className="font-mono text-xs text-text-secondary whitespace-nowrap">
                        {new Date(ev.evaluation_timestamp).toLocaleString([], {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit"
                        })}
                      </td>
                      <td className="font-mono font-bold text-xs text-brand">{ev.control_id}</td>
                      <td className="font-mono text-[11px] text-text-muted truncate max-w-[150px]">{ev.rule_id}</td>
                      <td>
                        <span className={`badge ${ev.status === "PASS" ? "badge-compliant" : "badge-failing"}`}>
                          <span className="dot"></span>
                          {ev.status}
                        </span>
                      </td>
                      <td><SeverityBadge severity={ev.severity} /></td>
                      <td className="font-mono text-[11px] text-text-muted truncate max-w-xs" title={ev.observed_result}>
                        {ev.observed_result}
                      </td>
                      <td>
                        <div className="flex items-center space-x-1.5 font-mono text-[11px] text-brand">
                          <span title={ev.evidence_hash} className="truncate max-w-[120px]">
                            {ev.evidence_hash.substring(0, 16)}...
                          </span>
                          <button
                            onClick={() => copyToClipboard(ev.evidence_hash, ev.id)}
                            title="Copy deterministic evidence hash"
                            className="text-text-muted hover:text-white transition-colors p-1"
                          >
                            {copiedHash === ev.id ? (
                              <Check className="h-3.5 w-3.5 text-brand" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
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

      {/* Drawer Overlay Backdrop */}
      <div
        className={`drawer-scrim ${drawerOpen ? "open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer Container Panel */}
      <div className={`drawer ${drawerOpen ? "open" : ""}`}>
        <div className="drawer-head">
          <div>
            <div style={{ fontSize: "16.5px", fontWeight: 700 }} id="drTitle">
              {selectedFinding?.check_name || "—"}
            </div>
            <div style={{ marginTop: "8px" }} id="drBadges">
              {selectedFinding && (
                <>
                  <SeverityBadge severity={selectedFinding.severity} />
                  <span className={`class-pill ${selectedFinding.drift_type === "POLICY_CHANGE_NON_COMPLIANCE" ? "policy" : "drift"} ml-2`}>
                    {selectedFinding.drift_type === "POLICY_CHANGE_NON_COMPLIANCE" ? "Policy change" : "Device drift"}
                  </span>
                </>
              )}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setDrawerOpen(false)} aria-label="Close details">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="drawer-body">
          {selectedFinding && (
            <>
              <div className="kv">
                <div className="k">Workstation</div>
                <div className="v">{device.hostname}</div>
              </div>
              <div className="kv">
                <div className="k">Rule</div>
                <div className="v mono">{selectedFinding.rule_id}</div>
              </div>
              <div className="kv">
                <div className="k">Classification</div>
                <div className="v mono">{selectedFinding.drift_type || "DEVICE_DRIFT"}</div>
              </div>
              <div className="kv">
                <div className="k">Status</div>
                <div className="v">{selectedFinding.status === "OPEN" ? "Open" : "Resolved"}</div>
              </div>
              <div className="kv">
                <div className="k">Reason</div>
                <div className="v" style={{ textAlign: "right", maxWidth: "220px" }}>
                  {selectedFinding.reason || "No extra failure details available."}
                </div>
              </div>
              <div className="kv">
                <div className="k">First detected</div>
                <div className="v">{getRelativeTime(selectedFinding.first_detected_at)}</div>
              </div>
              {selectedFinding.last_detected_at && (
                <div className="kv">
                  <div className="k">Last detected</div>
                  <div className="v">{getRelativeTime(selectedFinding.last_detected_at)}</div>
                </div>
              )}
              {selectedFinding.status === "RESOLVED" && (
                <>
                  <div className="kv">
                    <div className="k">Resolved</div>
                    <div className="v">{getRelativeTime(selectedFinding.resolved_at)}</div>
                  </div>
                  <div className="kv">
                    <div className="k">Resolution reason</div>
                    <div className="v mono">{selectedFinding.resolution_reason || "REMEDIATED"}</div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
