"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { ShieldCheck, Laptop, RefreshCw, Download, AlertTriangle, ShieldAlert } from "lucide-react"
import {
  PageHeader, LoadingState, EmptyState, Panel, StatusBadge, ConnectionBadge
} from "../../../components/ui"

interface Device {
  id: string
  hostname: string
  os_name: string
  os_version: string
  os_arch: string
  status: string
  compliance_status: string
  compliance_score: number
  last_checkin: string | null
}

interface EventLog {
  id: string
  type: "VIOLATION_TRIGGERED" | "VIOLATION_RESOLVED"
  timestamp: string
  message: string
  rule_name: string
  device_id: string
  device_hostname: string
  finding_id: string | null
  policy_version_id: string | null
  policy_name: string | null
  policy_version_number: number | null
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

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([])
  const [policy, setPolicy] = useState<any>(null)
  const [events, setEvents] = useState<EventLog[]>([])
  const [openFindings, setOpenFindings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const token = localStorage.getItem("flientsec_token")
        if (!token) {
          setError("No session active. Redirecting...")
          return
        }
        const headers = { Authorization: `Bearer ${token}` }

        // Fetch Device registry
        const devicesRes = await fetch(`${apiUrl}/api/v1/devices`, { headers })
        if (!devicesRes.ok) {
          if (devicesRes.status === 401) {
            localStorage.removeItem("flientsec_token")
            window.location.href = "/login"
            return
          }
          throw new Error("Failed to load device listing")
        }
        const devicesList = await devicesRes.json()
        setDevices(devicesList)

        // Fetch primary Policy to get baseline/active version details
        const policyRes = await fetch(`${apiUrl}/api/v1/policies`, { headers })
        if (policyRes.ok) {
          const policyData = await policyRes.json()
          setPolicy(policyData)
        }

        // Fetch events for recent activity feed
        const eventsRes = await fetch(`${apiUrl}/api/v1/events?limit=4`, { headers })
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json()
          setEvents(eventsData.items || [])
        }

        // Fetch open findings for mapping issues on dashboard attention list
        const openFindingsRes = await fetch(`${apiUrl}/api/v1/findings?status=OPEN&limit=100`, { headers })
        if (openFindingsRes.ok) {
          const openFindingsData = await openFindingsRes.json()
          setOpenFindings(openFindingsData.items || [])
        }

        setError(null)
      } catch (err: any) {
        setError(err.message || "An error occurred while connecting to the backend.")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [refreshKey, apiUrl])

  const exportReport = () => {
    const token = localStorage.getItem("flientsec_token")
    if (!token) return
    window.open(`${apiUrl}/api/v1/reports/export?token=${token}`, "_blank")
  }

  // Authoritative Calculations
  const totalCount = devices.length
  const compliantCount = devices.filter((d) => d.compliance_status === "PASS").length
  const warningCount = devices.filter((d) => d.compliance_status === "WARN").length
  const failedCount = devices.filter((d) => d.compliance_status === "FAIL").length

  // Posture Percentage Score (arithmetic average of device compliance scores)
  const devicesWithScore = devices.filter(
    (d) => d.compliance_score !== undefined && d.compliance_score !== null
  )
  const fleetPostureScore = devicesWithScore.length > 0
    ? Math.round(devicesWithScore.reduce((acc, d) => acc + d.compliance_score, 0) / devicesWithScore.length)
    : 100

  // Devices requiring action (Needs Attention: compliance_status !== "PASS" || status !== "ONLINE")
  const attentionDevices = devices.filter(
    (d) => d.compliance_status !== "PASS" || d.status !== "ONLINE"
  )
  const attentionCount = attentionDevices.length

  // Determine top active issue for each workstation in the attention list
  const getDeviceTopIssue = (deviceId: string) => {
    const devFindings = openFindings.filter((f) => f.device_id === deviceId)
    if (devFindings.length === 0) return null
    const severityWeight = (sev: string) => {
      const s = sev.toUpperCase()
      if (s === "HIGH" || s === "CRITICAL") return 3
      if (s === "MEDIUM") return 2
      return 1
    }
    return [...devFindings].sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))[0]
  }

  // Policy references
  const hasActivePolicy = policy && policy.active_version_id
  const activePolicyName = policy ? policy.name : "None Assigned"
  const activePolicyVer = hasActivePolicy ? `v${policy.active_version_number}` : "No active baseline"

  if (loading) {
    return <LoadingState message="Retrieving fleet security posture..." />
  }

  if (error) {
    return (
      <div className="space-y-6 font-sans">
        <PageHeader
          title="Dashboard"
          subtitle="Current security posture of your engineering fleet."
        />
        <div className="panel p-5 space-y-4 border border-danger/30 bg-danger/5">
          <div className="flex items-center space-x-2 text-danger">
            <ShieldAlert className="h-5 w-5" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            onClick={() => setRefreshKey((prev) => prev + 1)}
            className="btn"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry Connection</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans">
      {/* Header action bar */}
      <PageHeader
        title="Dashboard"
        subtitle="Current security posture of your engineering fleet."
        actions={
          <div className="flex items-center space-x-2">
            <button
              onClick={exportReport}
              className="btn btn-sm"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => setRefreshKey((prev) => prev + 1)}
              className="btn btn-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* SECTION 1 — POSTURE HERO */}
      <div className="section">
        <div className="posture-hero">
          <div>
            <div className={`posture-score-big ${fleetPostureScore >= 90 ? '' : fleetPostureScore >= 70 ? 'warn' : 'bad'}`}>
              {fleetPostureScore}%
            </div>
            <div className="posture-caption">
              {fleetPostureScore >= 90
                ? "Healthy fleet posture"
                : fleetPostureScore >= 70
                ? "Fleet posture needs attention"
                : "Fleet posture is degraded"}
            </div>
          </div>
          <div className="posture-side">
            <div className="n">{totalCount} workstations</div>
            <div className="l">{compliantCount} compliant · {warningCount} warning · {failedCount} failing</div>
          </div>
        </div>
      </div>

      {/* SECTION 2 — ATTENTION REQUIRED */}
      <div className="section">
        <div className="section-head">
          <div className="section-title">Attention required</div>
          <div className="section-hint">Sorted by compliance score</div>
        </div>

        {attentionCount === 0 ? (
          <div className="empty">
            <ShieldCheck className="h-6 w-6 text-text-muted mb-3 mx-auto" />
            <div className="empty-title">Nothing needs attention</div>
            <div className="empty-body">Every workstation is currently compliant.</div>
          </div>
        ) : (
          <div className="att-list">
            {attentionDevices.map((device) => {
              const topIssue = getDeviceTopIssue(device.id)
              const isOutdatedPolicy = device.compliance_status === "WARN" && device.status === "ONLINE"

              return (
                <Link
                  key={device.id}
                  href={`/devices/${device.id}`}
                  className="att-row"
                >
                  <div>
                    <div className="att-device">{device.hostname}</div>
                    <div className="att-uuid mono">{device.id}</div>
                  </div>
                  <div className="att-issue">
                    {device.status !== "ONLINE" ? (
                      <span className="text-danger font-semibold">Offline</span>
                    ) : topIssue ? (
                      <span className="text-text-secondary">{topIssue.check_name}</span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}

                    {topIssue && device.status === "ONLINE" && (
                      <span className={`sev ${
                        topIssue.severity.toUpperCase() === "HIGH" ? "sev-high" :
                        topIssue.severity.toUpperCase() === "MEDIUM" ? "sev-medium" : "sev-low"
                      } ml-2`}>
                        {topIssue.severity}
                      </span>
                    )}

                    {device.status !== "ONLINE" ? (
                      <span className="class-pill drift ml-2">
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 inline mr-1"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        Device status
                      </span>
                    ) : topIssue?.drift_type === "POLICY_CHANGE_NON_COMPLIANCE" || isOutdatedPolicy ? (
                      <span className="class-pill policy ml-2">
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 inline mr-1"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        Policy change
                      </span>
                    ) : (
                      <span className="class-pill drift ml-2">
                        <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 inline mr-1"><path d="M17 2 21 6 17 10"/><path d="M3 12v-1a4 4 0 0 1 4-4h14"/><path d="M7 22 3 18 7 14"/><path d="M21 12v1a4 4 0 0 1-4 4H3"/></svg>
                        Device drift
                      </span>
                    )}
                  </div>
                  <div className="att-score">{device.compliance_score}/100</div>
                  <div className="att-time">{getRelativeTime(device.last_checkin)}</div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* SECTION 3 — POSTURE DISTRIBUTION */}
      <div className="section">
        <div className="section-head">
          <div className="section-title">Posture distribution</div>
        </div>
        <div className="panel">
          {totalCount > 0 ? (
            <>
              <div className="dist-bar">
                <div className="dist-seg compliant" style={{ width: `${(compliantCount / totalCount) * 100}%` }}></div>
                <div className="dist-seg warning" style={{ width: `${(warningCount / totalCount) * 100}%` }}></div>
                <div className="dist-seg failing" style={{ width: `${(failedCount / totalCount) * 100}%` }}></div>
              </div>
              <div className="dist-legend">
                <div className="dist-legend-item">
                  <span className="sw" style={{ background: "var(--success)" }}></span>
                  Compliant · {compliantCount}
                </div>
                <div className="dist-legend-item">
                  <span className="sw" style={{ background: "var(--warning)" }}></span>
                  Warning · {warningCount}
                </div>
                <div className="dist-legend-item">
                  <span className="sw" style={{ background: "var(--danger)" }}></span>
                  Failing · {failedCount}
                </div>
              </div>
            </>
          ) : (
            <div className="dist-bar"></div>
          )}
        </div>
      </div>

      {/* SECTION 4 — POLICY BASELINE */}
      <div className="section">
        <div className="section-head">
          <div className="section-title">Policy baseline</div>
        </div>
        <div className="panel flex justify-between items-center flex-wrap gap-4">
          <div>
            <div className="stat-label" style={{ marginBottom: "6px" }}>Active policy</div>
            <div style={{ fontSize: "17px", fontWeight: 700 }}>
              {activePolicyName} <span className="mono muted" style={{ fontSize: "13px", fontWeight: 600 }}>{activePolicyVer}</span>
            </div>
            <div className="secondary-text text-xs mt-1.5">
              Published · applied as default for new devices
            </div>
          </div>
          <Link href="/policies" className="btn">
            View policy
          </Link>
        </div>
      </div>

      {/* SECTION 5 — RECENT ACTIVITY */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-head">
          <div className="section-title">Recent activity</div>
          <Link href="/activity" className="section-hint hover:text-text-primary transition-colors">
            View all
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="empty">
            <ShieldCheck className="h-6 w-6 text-text-muted mb-3 mx-auto" />
            <div className="empty-title">No recent activity</div>
          </div>
        ) : (
          <div className="event-list">
            {events.map((e) => (
              <div key={e.id} className="event-item">
                <div className="event-row">
                  <div className="event-dot-outer">
                    <div className={`event-dot ${e.type === "VIOLATION_TRIGGERED" ? "trigger" : "resolve"}`} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="event-title">
                      {e.type === "VIOLATION_TRIGGERED" ? "Violation triggered" : "Violation resolved"}
                    </div>
                    <div className="event-msg">{e.device_hostname} · {e.message}</div>
                    <div className="event-meta">
                      <span className="mono">{e.rule_name}</span>
                      <span>{e.policy_name || "Baseline Policy"} · v{e.policy_version_number || 2}</span>
                      <span>{getRelativeTime(e.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Icon helper placeholders to avoid undefined imports
const FileText = (props: any) => (
  <svg {...props} fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
)
const Shield = (props: any) => (
  <svg {...props} fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)
