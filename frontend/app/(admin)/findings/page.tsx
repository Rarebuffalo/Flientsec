"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  RotateCw, FilterX, X
} from "lucide-react"
import {
  PageHeader, LoadingState, EmptyState, StatusBadge, SeverityBadge
} from "../../../components/ui"

interface Finding {
  id: string
  device_id: string
  device_hostname: string
  policy_id: string | null
  policy_name: string | null
  rule_id: string
  check_name: string
  severity: "HIGH" | "MEDIUM" | "LOW"
  status: "OPEN" | "RESOLVED"
  reason: string | null
  drift_type: "DEVICE_DRIFT" | "POLICY_CHANGE_NON_COMPLIANCE" | null
  resolution_reason: string | null
  first_detected_at: string
  last_detected_at: string
  resolved_at: string | null
}

interface Device {
  id: string
  hostname: string
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

export default function FindingsPage() {
  const router = useRouter()
  const [findings, setFindings] = useState<Finding[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Authoritative pagination & pagination boundaries
  const [total, setTotal] = useState(0)
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)

  // Active / Resolved workflow tabs
  const [activeTab, setActiveTab] = useState<"OPEN" | "RESOLVED">("OPEN")

  // Server-side filters state
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [classificationFilter, setClassificationFilter] = useState<string>("all")
  const [deviceFilter, setDeviceFilter] = useState<string>("all")

  // Inspection Drawer state
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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
    } catch (e) {
      // Fail silently
    }
  }

  // Fetch paginated findings list using GET /api/v1/findings
  const fetchFindings = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("flientsec_token")
      if (!token) {
        router.push("/login")
        return
      }
      const headers = { Authorization: `Bearer ${token}` }

      // Construct server-side query parameters
      const params = new URLSearchParams()
      params.append("status", activeTab)
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

  // Reload findings whenever filters, pagination offset or tab state changes
  useEffect(() => {
    fetchFindings()
  }, [activeTab, severityFilter, classificationFilter, deviceFilter, offset])

  // Reset pagination offset whenever a filter or tab switches
  useEffect(() => {
    setOffset(0)
  }, [activeTab, severityFilter, classificationFilter, deviceFilter])

  // Retrieve initial datasets
  useEffect(() => {
    fetchDevices()
  }, [])

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

  // Clear filters action
  const handleClearFilters = () => {
    setSeverityFilter("all")
    setClassificationFilter("all")
    setDeviceFilter("all")
    setOffset(0)
  }

  const handleRowClick = (finding: Finding) => {
    setSelectedFinding(finding)
    setDrawerOpen(true)
  }

  // Pagination boundaries
  const totalPages = Math.ceil(total / limit)
  const currentPage = Math.floor(offset / limit) + 1

  const handlePreviousPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit))
    }
  }

  const handleNextPage = () => {
    if (offset + limit < total) {
      setOffset(offset + limit)
    }
  }

  const hasActiveFilters = severityFilter !== "all" || classificationFilter !== "all" || deviceFilter !== "all"

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans">

      {/* Page Header */}
      <PageHeader
        title="Findings"
        subtitle="Security issue management across the fleet."
        actions={
          <button
            onClick={fetchFindings}
            className="btn btn-sm"
            aria-label="Reload findings"
            title="Reload list"
          >
            <RotateCw className="h-4.5 w-4.5" />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Tabs */}
      <div className="tabs">
        <div
          onClick={() => setActiveTab("OPEN")}
          className={`tab ${activeTab === "OPEN" ? "active" : ""}`}
        >
          Active
        </div>
        <div
          onClick={() => setActiveTab("RESOLVED")}
          className={`tab ${activeTab === "RESOLVED" ? "active" : ""}`}
        >
          Resolved
        </div>
      </div>

      {/* Filter Row */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
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
            Clear
          </button>
        )}
      </div>

      {/* Main Table Body */}
      {loading ? (
        <LoadingState message="Fetching findings from fleet database..." />
      ) : error ? (
        <div className="panel p-5 border border-danger/30 bg-danger/5 text-danger flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchFindings} className="btn btn-sm">Retry</button>
        </div>
      ) : findings.length === 0 ? (
        <div className="py-6">
          <EmptyState
            title={hasActiveFilters ? "No matching findings" : activeTab === "OPEN" ? "No active findings" : "No resolved findings"}
            description={hasActiveFilters ? "Try adjusting severity, classification, or workstation filters." : activeTab === "OPEN" ? "Every workstation currently satisfies its assigned policy." : "No violations have been archived yet."}
            icon={FilterX}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Finding</th>
                  <th>Severity</th>
                  <th>Workstation</th>
                  <th>Classification</th>
                  <th>{activeTab === "OPEN" ? "Detected" : "Resolved"}</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => (
                  <tr
                    key={f.id}
                    onClick={() => handleRowClick(f)}
                    className="clickable"
                  >
                    <td data-label="Finding">
                      <div className="cell-primary">{f.check_name}</div>
                      <div className="cell-sub mono">{f.rule_id}</div>
                    </td>
                    <td data-label="Severity">
                      <SeverityBadge severity={f.severity} />
                    </td>
                    <td data-label="Workstation">{f.device_hostname}</td>
                    <td data-label="Classification">
                      <span className={`class-pill ${f.drift_type === "POLICY_CHANGE_NON_COMPLIANCE" ? "policy" : "drift"}`}>
                        {f.drift_type === "POLICY_CHANGE_NON_COMPLIANCE" ? "Policy change" : "Device drift"}
                      </span>
                    </td>
                    <td data-label="When" className="muted">
                      {activeTab === "OPEN" ? getRelativeTime(f.first_detected_at) : getRelativeTime(f.resolved_at)}
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
                <div className="v">{selectedFinding.device_hostname}</div>
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

              <div className="pt-6">
                <button
                  onClick={() => {
                    setDrawerOpen(false)
                    router.push(`/devices/${selectedFinding.device_id}`)
                  }}
                  className="btn btn-primary w-full justify-center"
                >
                  View workstation detail
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
