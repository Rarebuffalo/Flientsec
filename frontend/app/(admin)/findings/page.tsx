"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  RotateCw, FilterX, X, Copy, Check, ShieldAlert, ShieldCheck,
  AlertTriangle, Clock, Terminal, Info, ExternalLink, Calendar,
  User, Tag, FileText, CheckCircle2, ChevronRight
} from "lucide-react"
import {
  PageHeader, LoadingState, EmptyState, SeverityBadge
} from "../../../components/ui"

interface FindingSummary {
  total: number
  open_count: number
  critical_high_count: number
  acknowledged_count: number
  in_remediation_count: number
  waived_count: number
  resolved_count: number
}

interface Finding {
  id: string
  device_id: string
  device_hostname: string
  policy_id: string | null
  policy_name: string | null
  rule_id: string
  check_name: string
  severity: "HIGH" | "MEDIUM" | "LOW"
  status: "OPEN" | "ACKNOWLEDGED" | "IN_REMEDIATION" | "WAIVED" | "RESOLVED"
  reason: string | null
  drift_type: "DEVICE_DRIFT" | "POLICY_CHANGE_NON_COMPLIANCE" | null
  resolution_reason: string | null
  first_detected_at: string
  last_detected_at: string
  resolved_at: string | null
  acknowledged_at?: string | null
  acknowledged_by_id?: string | null
  remediation_started_at?: string | null
  remediation_started_by_id?: string | null
  remediation_note?: string | null
  waived_at?: string | null
  waived_by_id?: string | null
  waiver_reason?: string | null
  waiver_expires_at?: string | null
  waiver_owner?: string | null
  waiver_ticket_id?: string | null
}

interface RemediationCommandGuidance {
  os_name: string
  remediation_cmd: string
  verification_cmd: string
  notes?: string | null
}

interface RemediationGuidance {
  rule_id: string
  title: string
  why_it_matters: string
  expected_state: string
  observed_state: string
  os_guidance: RemediationCommandGuidance[]
  automated_verification_note: string
}

interface FindingDetail extends Finding {
  acknowledged_by_email?: string | null
  remediation_started_by_email?: string | null
  waived_by_email?: string | null
  guidance?: RemediationGuidance
  events?: Array<{
    id: string
    type: string
    timestamp: string
    message: string
  }>
}

interface Device {
  id: string
  hostname: string
}

// Relative time formatter helper
function getRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "Never"
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  if (diffMs < 0) {
    // Future date
    const futureSec = Math.floor(Math.abs(diffMs) / 1000)
    const futureDays = Math.floor(futureSec / 86400)
    if (futureDays > 0) return `in ${futureDays}d`
    const futureHours = Math.floor(futureSec / 3600)
    if (futureHours > 0) return `in ${futureHours}h`
    return "soon"
  }
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

function FindingStatusBadge({ status }: { status: Finding["status"] }) {
  switch (status) {
    case "OPEN":
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-danger/10 text-danger border border-danger/25">OPEN</span>
    case "ACKNOWLEDGED":
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">ACKNOWLEDGED</span>
    case "IN_REMEDIATION":
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/25">IN REMEDIATION</span>
    case "WAIVED":
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/25">WAIVED</span>
    case "RESOLVED":
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-brand/10 text-brand border border-brand/25">RESOLVED</span>
    default:
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-neutral-800 text-neutral-300">{status}</span>
  }
}

export default function FindingsPage() {
  const router = useRouter()
  const [findings, setFindings] = useState<Finding[]>([])
  const [summary, setSummary] = useState<FindingSummary | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Authoritative pagination
  const [total, setTotal] = useState(0)
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)

  // Status Filter: "ALL", "OPEN", "ACKNOWLEDGED", "IN_REMEDIATION", "WAIVED", "RESOLVED"
  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  // Server-side filters state
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [classificationFilter, setClassificationFilter] = useState<string>("all")
  const [deviceFilter, setDeviceFilter] = useState<string>("all")

  // Inspection Drawer & Full Finding Details
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null)
  const [findingDetail, setFindingDetail] = useState<FindingDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedOsTab, setSelectedOsTab] = useState<number>(0)
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null)

  // Modals state
  const [actionModal, setActionModal] = useState<"NONE" | "REMEDIATION" | "WAIVER">("NONE")
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Remediation Modal form
  const [remNote, setRemNote] = useState("")

  // Waiver Modal form
  const [waiverReason, setWaiverReason] = useState("")
  const [waiverExpiresAt, setWaiverExpiresAt] = useState("")
  const [waiverOwner, setWaiverOwner] = useState("")
  const [waiverTicketId, setWaiverTicketId] = useState("")

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  // Fetch summary counts
  const fetchSummary = async () => {
    try {
      const token = localStorage.getItem("flientsec_token")
      if (!token) return
      const res = await fetch(`${apiUrl}/api/v1/findings/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setSummary(data)
      }
    } catch {
      // ignore
    }
  }

  // Fetch workstations list for the Device filter dropdown list
  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem("flientsec_token")
      if (!token) return
      const res = await fetch(`${apiUrl}/api/v1/devices`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setDevices(data.map((d: any) => ({ id: d.id, hostname: d.hostname })))
      }
    } catch {
      // Fail silently
    }
  }

  // Fetch paginated findings list
  const fetchFindings = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("flientsec_token")
      if (!token) {
        router.push("/login")
        return
      }
      const headers = { Authorization: `Bearer ${token}` }

      const params = new URLSearchParams()
      if (statusFilter !== "ALL") {
        params.append("status", statusFilter)
      }
      params.append("limit", limit.toString())
      params.append("offset", offset.toString())

      if (severityFilter !== "all") {
        params.append("severity", severityFilter)
      }
      if (classificationFilter !== "all") {
        params.append("drift_type", classificationFilter)
      }
      if (deviceFilter !== "all") {
        params.append("device_id", deviceFilter)
      }

      const res = await fetch(`${apiUrl}/api/v1/findings?${params.toString()}`, { headers })
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("flientsec_token")
          router.push("/login")
          return
        }
        throw new Error("Failed to retrieve findings from database")
      }
      const data = await res.json()
      setFindings(data.items || [])
      setTotal(data.total || 0)
      setError(null)
    } catch (err: any) {
      setError(err.message || "Could not establish database connection.")
    } finally {
      setLoading(false)
    }
  }

  // Fetch deep finding details with authoritative remediation guidance
  const loadFindingDetail = async (id: string) => {
    try {
      setLoadingDetail(true)
      setSelectedFindingId(id)
      setDrawerOpen(true)
      setSelectedOsTab(0)
      const token = localStorage.getItem("flientsec_token")
      if (!token) return
      const res = await fetch(`${apiUrl}/api/v1/findings/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setFindingDetail(data)
      }
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    fetchFindings()
    fetchSummary()
  }, [statusFilter, severityFilter, classificationFilter, deviceFilter, offset])

  useEffect(() => {
    setOffset(0)
  }, [statusFilter, severityFilter, classificationFilter, deviceFilter])

  useEffect(() => {
    fetchDevices()
  }, [])

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false)
        setActionModal("NONE")
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Clear filters action
  const handleClearFilters = () => {
    setStatusFilter("ALL")
    setSeverityFilter("all")
    setClassificationFilter("all")
    setDeviceFilter("all")
    setOffset(0)
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCmd(key)
    setTimeout(() => setCopiedCmd(null), 2000)
  }

  // Acknowledge Action
  const handleAcknowledge = async () => {
    if (!selectedFindingId) return
    try {
      setActionLoading(true)
      const token = localStorage.getItem("flientsec_token")
      const res = await fetch(`${apiUrl}/api/v1/findings/${selectedFindingId}/acknowledge`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Failed to acknowledge finding")
      }
      await loadFindingDetail(selectedFindingId)
      await fetchFindings()
      await fetchSummary()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Start Remediation Action
  const handleStartRemediation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFindingId) return
    try {
      setActionLoading(true)
      setActionError(null)
      const token = localStorage.getItem("flientsec_token")
      const res = await fetch(`${apiUrl}/api/v1/findings/${selectedFindingId}/remediation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ note: remNote.trim() || undefined })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Failed to record remediation note")
      }
      setActionModal("NONE")
      setRemNote("")
      await loadFindingDetail(selectedFindingId)
      await fetchFindings()
      await fetchSummary()
    } catch (err: any) {
      setActionError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Waive Action
  const handleWaive = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFindingId) return
    if (!waiverReason.trim()) {
      setActionError("Waiver justification reason is required.")
      return
    }
    if (!waiverExpiresAt) {
      setActionError("Expiration date and time are required.")
      return
    }
    const expDate = new Date(waiverExpiresAt)
    if (expDate <= new Date()) {
      setActionError("Waiver expiration date must be strictly in the future.")
      return
    }

    try {
      setActionLoading(true)
      setActionError(null)
      const token = localStorage.getItem("flientsec_token")
      const res = await fetch(`${apiUrl}/api/v1/findings/${selectedFindingId}/waive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: waiverReason.trim(),
          expires_at: expDate.toISOString(),
          owner: waiverOwner.trim() || undefined,
          ticket_id: waiverTicketId.trim() || undefined
        })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Failed to grant policy waiver")
      }
      setActionModal("NONE")
      setWaiverReason("")
      setWaiverExpiresAt("")
      setWaiverOwner("")
      setWaiverTicketId("")
      await loadFindingDetail(selectedFindingId)
      await fetchFindings()
      await fetchSummary()
    } catch (err: any) {
      setActionError(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Pagination boundaries
  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  const handlePreviousPage = () => {
    if (offset > 0) setOffset(Math.max(0, offset - limit))
  }

  const handleNextPage = () => {
    if (offset + limit < total) setOffset(offset + limit)
  }

  const hasActiveFilters = statusFilter !== "ALL" || severityFilter !== "all" || classificationFilter !== "all" || deviceFilter !== "all"

  return (
    <div className="space-y-6 flex-1 flex flex-col font-sans">
      {/* Page Header */}
      <PageHeader
        title="Findings & Remediation"
        subtitle="Operational finding lifecycle, exception tracking, and copyable verification guidance."
        actions={
          <button
            onClick={() => {
              fetchFindings()
              fetchSummary()
            }}
            className="btn btn-sm"
            aria-label="Reload findings"
            title="Reload list"
          >
            <RotateCw className="h-4.5 w-4.5" />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Operational Summary Bar */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            onClick={() => setStatusFilter("OPEN")}
            className={`panel p-3.5 cursor-pointer transition-all border ${statusFilter === "OPEN" ? "border-danger bg-danger/5" : "hover:border-border-hover"}`}
          >
            <div className="text-xs text-text-secondary font-medium">Open</div>
            <div className="text-2xl font-bold text-danger mt-1">{summary.open_count}</div>
          </div>
          <div
            onClick={() => {
              setStatusFilter("ALL")
              setSeverityFilter("HIGH")
            }}
            className={`panel p-3.5 cursor-pointer transition-all border ${severityFilter === "HIGH" ? "border-danger bg-danger/5" : "hover:border-border-hover"}`}
          >
            <div className="text-xs text-text-secondary font-medium">Critical / High</div>
            <div className="text-2xl font-bold text-danger mt-1">{summary.critical_high_count}</div>
          </div>
          <div
            onClick={() => setStatusFilter("IN_REMEDIATION")}
            className={`panel p-3.5 cursor-pointer transition-all border ${statusFilter === "IN_REMEDIATION" ? "border-sky-400 bg-sky-500/5" : "hover:border-border-hover"}`}
          >
            <div className="text-xs text-text-secondary font-medium">In Remediation</div>
            <div className="text-2xl font-bold text-sky-400 mt-1">{summary.in_remediation_count}</div>
          </div>
          <div
            onClick={() => setStatusFilter("ACKNOWLEDGED")}
            className={`panel p-3.5 cursor-pointer transition-all border ${statusFilter === "ACKNOWLEDGED" ? "border-amber-400 bg-amber-500/5" : "hover:border-border-hover"}`}
          >
            <div className="text-xs text-text-secondary font-medium">Acknowledged</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{summary.acknowledged_count}</div>
          </div>
          <div
            onClick={() => setStatusFilter("WAIVED")}
            className={`panel p-3.5 cursor-pointer transition-all border ${statusFilter === "WAIVED" ? "border-purple-400 bg-purple-500/5" : "hover:border-border-hover"}`}
          >
            <div className="text-xs text-text-secondary font-medium">Waived / Exceptions</div>
            <div className="text-2xl font-bold text-purple-400 mt-1">{summary.waived_count}</div>
          </div>
          <div
            onClick={() => setStatusFilter("RESOLVED")}
            className={`panel p-3.5 cursor-pointer transition-all border ${statusFilter === "RESOLVED" ? "border-brand bg-brand/5" : "hover:border-border-hover"}`}
          >
            <div className="text-xs text-text-secondary font-medium">Resolved</div>
            <div className="text-2xl font-bold text-brand mt-1">{summary.resolved_count}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <div
          onClick={() => setStatusFilter("ALL")}
          className={`tab ${statusFilter === "ALL" ? "active" : ""}`}
        >
          All Findings
        </div>
        <div
          onClick={() => setStatusFilter("OPEN")}
          className={`tab ${statusFilter === "OPEN" ? "active" : ""}`}
        >
          Open
        </div>
        <div
          onClick={() => setStatusFilter("IN_REMEDIATION")}
          className={`tab ${statusFilter === "IN_REMEDIATION" ? "active" : ""}`}
        >
          In Remediation
        </div>
        <div
          onClick={() => setStatusFilter("ACKNOWLEDGED")}
          className={`tab ${statusFilter === "ACKNOWLEDGED" ? "active" : ""}`}
        >
          Acknowledged
        </div>
        <div
          onClick={() => setStatusFilter("WAIVED")}
          className={`tab ${statusFilter === "WAIVED" ? "active" : ""}`}
        >
          Waived
        </div>
        <div
          onClick={() => setStatusFilter("RESOLVED")}
          className={`tab ${statusFilter === "RESOLVED" ? "active" : ""}`}
        >
          Resolved
        </div>
      </div>

      {/* Filter Row */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="select"
        >
          <option value="all">All severities</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <select
          value={classificationFilter}
          onChange={(e) => setClassificationFilter(e.target.value)}
          className="select"
        >
          <option value="all">All classifications</option>
          <option value="DEVICE_DRIFT">Device drift</option>
          <option value="POLICY_CHANGE_NON_COMPLIANCE">Policy change</option>
        </select>

        <select
          value={deviceFilter}
          onChange={(e) => setDeviceFilter(e.target.value)}
          className="select"
        >
          <option value="all">All workstations</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.hostname}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="btn btn-sm"
          >
            <FilterX className="h-3.5 w-3.5 inline mr-1" />
            Clear filters
          </button>
        )}
      </div>

      {/* Main Table Body */}
      {loading ? (
        <LoadingState message="Fetching fleet findings..." />
      ) : error ? (
        <div className="panel p-5 border border-danger/30 bg-danger/5 text-danger flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchFindings} className="btn btn-sm">Retry</button>
        </div>
      ) : findings.length === 0 ? (
        <div className="py-6">
          <EmptyState
            title={hasActiveFilters ? "No matching findings" : "No findings found"}
            description={hasActiveFilters ? "Try adjusting status, severity, or workstation filters." : "All fleet workstations are currently in compliance."}
            icon={FilterX}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Finding / Rule</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Workstation</th>
                  <th>Classification</th>
                  <th>{statusFilter === "RESOLVED" ? "Resolved" : "Detected"}</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => loadFindingDetail(f.id)}
                    className="clickable"
                  >
                    <td data-label="Finding">
                      <div className="cell-primary font-semibold">{f.check_name}</div>
                      <div className="cell-sub mono">{f.rule_id}</div>
                    </td>
                    <td data-label="Severity">
                      <SeverityBadge severity={f.severity} />
                    </td>
                    <td data-label="Status">
                      <FindingStatusBadge status={f.status} />
                    </td>
                    <td data-label="Workstation">{f.device_hostname}</td>
                    <td data-label="Classification">
                      <span className={`class-pill ${f.drift_type === "POLICY_CHANGE_NON_COMPLIANCE" ? "policy" : "drift"}`}>
                        {f.drift_type === "POLICY_CHANGE_NON_COMPLIANCE" ? "Policy change" : "Device drift"}
                      </span>
                    </td>
                    <td data-label="When" className="muted text-xs">
                      {f.status === "RESOLVED" ? getRelativeTime(f.resolved_at) : getRelativeTime(f.first_detected_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border border-border/80 rounded-xl bg-surface-1 p-4 text-sm mt-4">
              <span className="text-xs text-text-secondary">
                Showing <span className="font-semibold text-text-primary">{offset + 1}</span> to{" "}
                <span className="font-semibold text-text-primary">
                  {Math.min(total, offset + limit)}
                </span>{" "}
                of <span className="font-semibold text-text-primary">{total}</span> findings (Page {currentPage} of {totalPages})
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={handlePreviousPage}
                  disabled={offset === 0}
                  className={`btn btn-sm ${offset === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={offset + limit >= total}
                  className={`btn btn-sm ${offset + limit >= total ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Drawer Backdrop */}
      <div
        className={`drawer-scrim ${drawerOpen ? "open" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Enhanced Remediation Inspector Drawer */}
      <div className={`drawer ${drawerOpen ? "open" : ""}`} style={{ width: "min(680px, 100vw)" }}>
        <div className="drawer-head">
          <div>
            <div style={{ fontSize: "16.5px", fontWeight: 700 }}>
              {findingDetail?.check_name || "Finding Details"}
            </div>
            <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
              {findingDetail && (
                <>
                  <SeverityBadge severity={findingDetail.severity} />
                  <FindingStatusBadge status={findingDetail.status} />
                  <span className={`class-pill ${findingDetail.drift_type === "POLICY_CHANGE_NON_COMPLIANCE" ? "policy" : "drift"}`}>
                    {findingDetail.drift_type === "POLICY_CHANGE_NON_COMPLIANCE" ? "Policy change" : "Device drift"}
                  </span>
                </>
              )}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setDrawerOpen(false)} aria-label="Close details">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="drawer-body space-y-6">
          {loadingDetail ? (
            <LoadingState message="Loading remediation guidance & history..." />
          ) : findingDetail ? (
            <>
              {/* Context Summary */}
              <div className="panel p-4 space-y-2 border border-border/80 bg-surface-2/40">
                <div className="kv">
                  <div className="k">Workstation</div>
                  <div className="v font-semibold text-text-primary">{findingDetail.device_hostname}</div>
                </div>
                <div className="kv">
                  <div className="k">Rule Identifier</div>
                  <div className="v mono text-xs">{findingDetail.rule_id}</div>
                </div>
                <div className="kv">
                  <div className="k">Observed State</div>
                  <div className="v text-xs text-danger max-w-[280px] text-right">
                    {findingDetail.reason || "Control requirements not satisfied"}
                  </div>
                </div>
              </div>

              {/* Authoritative Remediation Guidance */}
              {findingDetail.guidance && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-brand" />
                      Remediation Guidance
                    </h4>
                    <span className="text-[11px] text-text-muted">Copyable Guidance</span>
                  </div>

                  {/* Why this matters */}
                  <div className="p-3.5 rounded-lg bg-surface-1 border border-border/70 text-xs text-text-secondary leading-relaxed space-y-2">
                    <div>
                      <b className="text-text-primary block mb-0.5">Why this matters:</b>
                      {findingDetail.guidance.why_it_matters}
                    </div>
                    {findingDetail.guidance.expected_state && (
                      <div className="pt-1.5 border-t border-border/50">
                        <b className="text-brand block mb-0.5">Expected Baseline State:</b>
                        {findingDetail.guidance.expected_state}
                      </div>
                    )}
                  </div>

                  {/* OS Tabs */}
                  {findingDetail.guidance.os_guidance.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex border-b border-border text-xs gap-4">
                        {findingDetail.guidance.os_guidance.map((g, idx) => (
                          <button
                            key={g.os_name}
                            onClick={() => setSelectedOsTab(idx)}
                            className={`pb-2 font-medium transition-colors ${selectedOsTab === idx ? "border-b-2 border-brand text-brand" : "text-text-secondary hover:text-text-primary"}`}
                          >
                            {g.os_name}
                          </button>
                        ))}
                      </div>

                      {/* Active OS Snippet */}
                      {findingDetail.guidance.os_guidance[selectedOsTab] && (
                        <div className="space-y-3">
                          {/* Remediation Command */}
                          <div>
                            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                              <span>Recommended Remediation Command:</span>
                              <button
                                onClick={() => handleCopy(findingDetail.guidance!.os_guidance[selectedOsTab].remediation_cmd, "rem")}
                                className="text-brand hover:underline flex items-center gap-1 text-[11px]"
                              >
                                {copiedCmd === "rem" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copiedCmd === "rem" ? "Copied" : "Copy Command"}
                              </button>
                            </div>
                            <div className="bg-[#0B0D0C] border border-border p-3 rounded-lg font-mono text-xs text-text-primary select-all break-all">
                              {findingDetail.guidance.os_guidance[selectedOsTab].remediation_cmd}
                            </div>
                          </div>

                          {/* Verification Command */}
                          <div>
                            <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                              <span>Local Verification Command:</span>
                              <button
                                onClick={() => handleCopy(findingDetail.guidance!.os_guidance[selectedOsTab].verification_cmd, "ver")}
                                className="text-brand hover:underline flex items-center gap-1 text-[11px]"
                              >
                                {copiedCmd === "ver" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                {copiedCmd === "ver" ? "Copied" : "Copy"}
                              </button>
                            </div>
                            <div className="bg-[#0B0D0C] border border-border p-2.5 rounded-lg font-mono text-xs text-text-secondary select-all break-all">
                              {findingDetail.guidance.os_guidance[selectedOsTab].verification_cmd}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Automated Verification Callout Banner */}
                  <div className="p-3 rounded-lg border border-brand/20 bg-brand/5 flex items-start gap-2.5 text-xs text-text-secondary">
                    <ShieldCheck className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-text-primary">Evidence-Driven Verification: </span>
                      {findingDetail.guidance.automated_verification_note}
                    </div>
                  </div>
                </div>
              )}

              {/* Operational Status & History Information */}
              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-3">
                  Governance & Lifecycle History
                </h4>

                <div className="kv">
                  <div className="k">First Detected</div>
                  <div className="v text-xs">{new Date(findingDetail.first_detected_at).toLocaleString()} ({getRelativeTime(findingDetail.first_detected_at)})</div>
                </div>

                {findingDetail.acknowledged_at && (
                  <div className="kv">
                    <div className="k">Acknowledged</div>
                    <div className="v text-xs text-amber-400">
                      {new Date(findingDetail.acknowledged_at).toLocaleString()}
                      {findingDetail.acknowledged_by_email && ` by ${findingDetail.acknowledged_by_email}`}
                    </div>
                  </div>
                )}

                {findingDetail.remediation_started_at && (
                  <>
                    <div className="kv">
                      <div className="k">Remediation Started</div>
                      <div className="v text-xs text-sky-400">
                        {new Date(findingDetail.remediation_started_at).toLocaleString()}
                        {findingDetail.remediation_started_by_email && ` by ${findingDetail.remediation_started_by_email}`}
                      </div>
                    </div>
                    {findingDetail.remediation_note && (
                      <div className="p-2.5 rounded bg-surface-1 border border-border text-xs text-text-secondary">
                        <b className="text-text-primary block mb-0.5">Remediation Note:</b>
                        {findingDetail.remediation_note}
                      </div>
                    )}
                  </>
                )}

                {findingDetail.waived_at && (
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/25 space-y-1.5 text-xs">
                    <div className="font-semibold text-purple-300 flex items-center justify-between">
                      <span>Active Policy Waiver Granted</span>
                      <span>Expires {getRelativeTime(findingDetail.waiver_expires_at)}</span>
                    </div>
                    <div className="text-text-secondary">
                      <b>Justification:</b> {findingDetail.waiver_reason}
                    </div>
                    {findingDetail.waiver_expires_at && (
                      <div className="text-text-muted text-[11px]">
                        <b>Auto-Expires:</b> {new Date(findingDetail.waiver_expires_at).toLocaleString()}
                      </div>
                    )}
                    {findingDetail.waiver_owner && (
                      <div className="text-text-muted text-[11px]">
                        <b>Owner:</b> {findingDetail.waiver_owner}
                      </div>
                    )}
                    {findingDetail.waiver_ticket_id && (
                      <div className="text-text-muted text-[11px]">
                        <b>Ticket:</b> {findingDetail.waiver_ticket_id}
                      </div>
                    )}
                  </div>
                )}

                {findingDetail.status === "RESOLVED" && (
                  <div className="p-3 rounded-lg bg-brand/10 border border-brand/25 text-xs text-text-secondary space-y-1">
                    <div className="font-semibold text-brand flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      Resolved on Agent Check-in
                    </div>
                    <div>Resolved at {new Date(findingDetail.resolved_at!).toLocaleString()}</div>
                    <div className="mono text-[11px]">Reason: {findingDetail.resolution_reason || "REMEDIATED"}</div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {findingDetail.status !== "RESOLVED" && (
                <div className="pt-4 border-t border-border space-y-2">
                  <div className="flex gap-2 flex-wrap">
                    {findingDetail.status === "OPEN" && (
                      <button
                        onClick={handleAcknowledge}
                        disabled={actionLoading}
                        className="btn btn-sm flex-1 justify-center bg-surface-2 hover:bg-surface-3"
                      >
                        Acknowledge
                      </button>
                    )}

                    {findingDetail.status !== "IN_REMEDIATION" && (
                      <button
                        onClick={() => {
                          setActionModal("REMEDIATION")
                          setRemNote(findingDetail.remediation_note || "")
                          setActionError(null)
                        }}
                        className="btn btn-sm flex-1 justify-center bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30"
                      >
                        {findingDetail.status === "OPEN" || findingDetail.status === "ACKNOWLEDGED" ? "Start Remediation" : "Update Remediation Note"}
                      </button>
                    )}

                    {findingDetail.status !== "WAIVED" && (
                      <button
                        onClick={() => {
                          setActionModal("WAIVER")
                          setWaiverReason("")
                          setWaiverExpiresAt("")
                          setWaiverOwner("")
                          setWaiverTicketId("")
                          setActionError(null)
                        }}
                        className="btn btn-sm flex-1 justify-center bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30"
                      >
                        Grant Exception / Waive
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Workstation Link */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    setDrawerOpen(false)
                    router.push(`/devices/${findingDetail.device_id}`)
                  }}
                  className="btn btn-primary w-full justify-center"
                >
                  View Workstation Details
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Start Remediation Modal */}
      {actionModal === "REMEDIATION" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="panel max-w-md w-full p-6 border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-text-primary">Start Finding Remediation</h3>
              <button onClick={() => setActionModal("NONE")} className="btn btn-ghost btn-sm">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Mark this finding as actively being remediated by the security operations or infrastructure team.
            </p>

            {actionError && (
              <div className="p-3 text-xs text-danger bg-danger/10 border border-danger/25 rounded-lg">
                {actionError}
              </div>
            )}

            <form onSubmit={handleStartRemediation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Remediation Plan / Note (Optional)
                </label>
                <textarea
                  value={remNote}
                  onChange={(e) => setRemNote(e.target.value)}
                  placeholder="e.g., Applying Ansible playbook role or scheduled during maintenance window..."
                  rows={3}
                  className="textarea w-full text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal("NONE")}
                  className="btn btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-primary btn-sm"
                >
                  {actionLoading ? "Saving..." : "Confirm In-Remediation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grant Waiver Exception Modal */}
      {actionModal === "WAIVER" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="panel max-w-lg w-full p-6 border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-text-primary">Grant Controlled Finding Waiver</h3>
              <button onClick={() => setActionModal("NONE")} className="btn btn-ghost btn-sm">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Grant a controlled, auditable temporary exception for this security finding. If the waiver expires before the issue is remediated, the finding will automatically flip back to <b className="text-danger">OPEN</b> on the next check-in.
            </p>

            {actionError && (
              <div className="p-3 text-xs text-danger bg-danger/10 border border-danger/25 rounded-lg">
                {actionError}
              </div>
            )}

            <form onSubmit={handleWaive} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Waiver Justification Reason <span className="text-danger">*</span>
                </label>
                <textarea
                  required
                  value={waiverReason}
                  onChange={(e) => setWaiverReason(e.target.value)}
                  placeholder="e.g., Legacy database server undergoing hardware migration approved by CISO..."
                  rows={3}
                  className="textarea w-full text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Expiration Date & Time <span className="text-danger">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={waiverExpiresAt}
                  onChange={(e) => setWaiverExpiresAt(e.target.value)}
                  className="input w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Owner / Point of Contact (Optional)
                  </label>
                  <input
                    type="text"
                    value={waiverOwner}
                    onChange={(e) => setWaiverOwner(e.target.value)}
                    placeholder="e.g. devops-lead"
                    className="input w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Ticket ID / Reference (Optional)
                  </label>
                  <input
                    type="text"
                    value={waiverTicketId}
                    onChange={(e) => setWaiverTicketId(e.target.value)}
                    placeholder="e.g. SEC-8902"
                    className="input w-full text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setActionModal("NONE")}
                  className="btn btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-primary btn-sm bg-purple-600 hover:bg-purple-700"
                >
                  {actionLoading ? "Granting..." : "Grant Policy Waiver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
