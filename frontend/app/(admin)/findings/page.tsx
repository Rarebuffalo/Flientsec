"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { 
  ShieldCheck, Search, ShieldAlert, RotateCw, 
  FilterX, ChevronRight, X, AlertTriangle, HelpCircle
} from "lucide-react"
import { 
  PageHeader, LoadingState, EmptyState, Panel, 
  StatusBadge, SeverityBadge, DataTable 
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
  const [activeTab, setActiveTab] = useState<"active" | "resolved">("active")

  // Server-side filters state
  const [severityFilter, setSeverityFilter] = useState<string>("ALL")
  const [classificationFilter, setClassificationFilter] = useState<string>("ALL")
  const [deviceFilter, setDeviceFilter] = useState<string>("ALL")

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
      // Fail silently, filter is left empty or unpopulated
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
      params.append("status", activeTab === "active" ? "OPEN" : "RESOLVED")
      params.append("limit", limit.toString())
      params.append("offset", offset.toString())

      if (severityFilter !== "ALL") {
        params.append("severity", severityFilter)
      }
      if (classificationFilter !== "ALL") {
        params.append("drift_type", classificationFilter)
      }
      if (deviceFilter !== "ALL") {
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

  // Clear filters action
  const handleClearFilters = () => {
    setSeverityFilter("ALL")
    setClassificationFilter("ALL")
    setDeviceFilter("ALL")
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

  // Dynamic filter state indicator
  const hasActiveFilters = severityFilter !== "ALL" || classificationFilter !== "ALL" || deviceFilter !== "ALL"

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader 
        title="Findings" 
        subtitle="Investigate active workstation security violations and resolved posture drift."
        actions={
          <button 
            onClick={fetchFindings}
            className="p-2 border border-outline-variant hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-on-surface transition-colors"
            title="Reload list"
          >
            <RotateCw className="h-4.5 w-4.5" />
          </button>
        }
      />

      {/* Tabs */}
      <div className="border-b border-outline-variant/60 flex items-center justify-between pb-px">
        <div className="flex space-x-6 text-sm font-semibold select-none">
          <button
            onClick={() => setActiveTab("active")}
            className={`pb-3.5 relative transition-colors ${
              activeTab === "active" 
                ? "text-tertiary" 
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Active
            {activeTab === "active" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-tertiary rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("resolved")}
            className={`pb-3.5 relative transition-colors ${
              activeTab === "resolved" 
                ? "text-tertiary" 
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            Resolved
            {activeTab === "resolved" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-tertiary rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-surface-container-low border border-outline-variant/60 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 w-full sm:w-auto">
          {/* Severity selector */}
          <div className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 font-sans">Severity</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-tertiary font-sans"
            >
              <option value="ALL">All</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Classification selector */}
          <div className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 font-sans">Classification</span>
            <select
              value={classificationFilter}
              onChange={(e) => setClassificationFilter(e.target.value)}
              className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-tertiary font-sans"
            >
              <option value="ALL">All</option>
              <option value="DEVICE_DRIFT">Device drift</option>
              <option value="POLICY_CHANGE_NON_COMPLIANCE">Policy change</option>
            </select>
          </div>

          {/* Workstation Selector */}
          <div className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 font-sans">Workstation</span>
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-tertiary max-w-[200px] font-sans"
            >
              <option value="ALL">All Workstations</option>
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.hostname}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center space-x-2 text-xs font-semibold text-tertiary hover:text-white transition-colors py-2 px-3 border border-outline-variant rounded-lg bg-surface-container hover:bg-surface-container-high"
          >
            <FilterX className="h-3.5 w-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Main Body */}
      {loading ? (
        <Panel className="p-12">
          <LoadingState message="Fetching findings from fleet database..." />
        </Panel>
      ) : error ? (
        <Panel className="p-12 text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-error mx-auto" />
          <h3 className="text-base font-semibold text-on-surface font-sans">Error Fetching Posture Findings</h3>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto leading-relaxed font-sans">{error}</p>
          <button
            onClick={fetchFindings}
            className="px-4 py-2 text-xs font-semibold text-white bg-tertiary hover:bg-tertiary-hover rounded-lg transition-colors inline-flex items-center space-x-2"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Retry Query</span>
          </button>
        </Panel>
      ) : findings.length === 0 ? (
        <Panel className="p-16">
          {hasActiveFilters ? (
            <EmptyState 
              title="No findings match selected filters" 
              description="Refine your dropdown selectors or reset filters to display other results."
              icon={FilterX}
            />
          ) : activeTab === "active" ? (
            <EmptyState 
              title="No active findings" 
              description="Great! The engineering fleet currently has no open posture drift or policy compliance violations."
              icon={ShieldCheck}
            />
          ) : (
            <EmptyState 
              title="No resolved findings" 
              description="No posture violations have been archived or resolved yet."
              icon={ShieldCheck}
            />
          )}
        </Panel>
      ) : (
        <div className="space-y-4">
          {/* Table Container */}
          <Panel>
            <DataTable
              headers={[
                "Finding",
                "Workstation",
                "Classification",
                "Severity",
                "Policy",
                activeTab === "active" ? "Last Detected" : "Resolved At",
                "Inspect"
              ]}
              rows={findings}
              renderRow={(row: Finding) => (
                <tr 
                  key={row.id}
                  onClick={() => handleRowClick(row)}
                  className="hover:bg-surface-container-high/50 cursor-pointer transition-colors group"
                >
                  <td className="px-5 py-4">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-on-surface block leading-tight hover:text-tertiary transition-colors">
                        {row.check_name}
                      </span>
                      <span className="text-xs text-on-surface-variant font-mono leading-none block">
                        {row.rule_id}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-on-surface font-sans font-semibold">
                    {row.device_hostname}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-on-surface-variant">
                      {row.drift_type === "DEVICE_DRIFT" ? "Device drift" : row.drift_type === "POLICY_CHANGE_NON_COMPLIANCE" ? "Policy change" : "Baseline"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <SeverityBadge severity={row.severity} />
                  </td>
                  <td className="px-5 py-4 text-on-surface-variant font-sans">
                    {row.policy_name || "—"}
                  </td>
                  <td className="px-5 py-4 text-on-surface-variant font-sans">
                    {activeTab === "active" ? (
                      <span title={new Date(row.last_detected_at).toLocaleString()} className="cursor-help underline decoration-dotted decoration-outline-variant">
                        {getRelativeTime(row.last_detected_at)}
                      </span>
                    ) : (
                      <span title={row.resolved_at ? new Date(row.resolved_at).toLocaleString() : ""} className="cursor-help underline decoration-dotted decoration-outline-variant">
                        {row.resolved_at ? getRelativeTime(row.resolved_at) : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <ChevronRight className="h-4.5 w-4.5 text-on-surface-variant/45 group-hover:text-tertiary transition-colors ml-auto" />
                  </td>
                </tr>
              )}
            />
          </Panel>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border border-outline-variant/65 rounded-xl bg-surface-container-low p-4 text-sm">
              <span className="text-xs text-on-surface-variant font-medium font-sans">
                Showing <span className="font-semibold text-on-surface">{offset + 1}</span> to{" "}
                <span className="font-semibold text-on-surface">
                  {Math.min(total, offset + limit)}
                </span>{" "}
                of <span className="font-semibold text-on-surface">{total}</span> findings (Page {currentPage} of {totalPages})
              </span>
              <div className="flex space-x-2 font-sans select-none">
                <button
                  onClick={handlePreviousPage}
                  disabled={offset === 0}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    offset === 0
                      ? "border-outline-variant/30 text-on-surface-variant/30 cursor-not-allowed"
                      : "border-outline-variant hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={offset + limit >= total}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    offset + limit >= total
                      ? "border-outline-variant/30 text-on-surface-variant/30 cursor-not-allowed"
                      : "border-outline-variant hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inspection Right-Side Slide-out Drawer */}
      {drawerOpen && selectedFinding && (
        <>
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer container */}
          <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-md bg-[#18181c] border-l border-outline-variant shadow-2xl flex flex-col overflow-hidden animate-slide-in">
            {/* Drawer Header */}
            <div className="p-6 border-b border-outline-variant/70 flex items-center justify-between bg-[#1f1f24]">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-on-surface font-sans uppercase tracking-wide">Inspection Panel</h2>
                <p className="text-xs text-on-surface-variant font-sans">Active compliance posture failure analysis</p>
              </div>
              <button 
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Finding Title/Identification */}
              <div className="space-y-1.5">
                <span className="block text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-sans">Security Check</span>
                <h3 className="text-lg font-bold text-on-surface leading-snug font-sans">{selectedFinding.check_name}</h3>
                <div className="flex items-center space-x-2.5 pt-1 select-none">
                  <StatusBadge status={selectedFinding.status} />
                  <SeverityBadge severity={selectedFinding.severity} />
                </div>
              </div>

              <hr className="border-outline-variant/40" />

              {/* Technical / Structural Data Fields */}
              <div className="space-y-5">
                <div>
                  <span className="block text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-sans mb-1.5">Rule Identifier</span>
                  <code className="text-xs px-2 py-1 rounded bg-[#101014] border border-outline-variant/40 text-tertiary font-mono leading-none block w-fit">
                    {selectedFinding.rule_id}
                  </code>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-sans mb-1">Workstation Endpoint</span>
                  <p className="text-sm font-semibold text-on-surface font-sans">{selectedFinding.device_hostname}</p>
                  <span className="block text-xs font-mono text-on-surface-variant/70 mt-1 select-all">{selectedFinding.device_id}</span>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-sans mb-1">Classification</span>
                  <p className="text-sm font-semibold text-on-surface font-sans">
                    {selectedFinding.drift_type === "DEVICE_DRIFT" ? "Device drift" : selectedFinding.drift_type === "POLICY_CHANGE_NON_COMPLIANCE" ? "Policy change" : "Standard compliance"}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed font-sans bg-surface-container/30 border border-outline-variant/20 rounded-lg p-2.5">
                    {selectedFinding.drift_type === "DEVICE_DRIFT" 
                      ? "Device drift means the workstation itself drifted from the evaluated baseline."
                      : selectedFinding.drift_type === "POLICY_CHANGE_NON_COMPLIANCE"
                      ? "Policy change means a policy update caused the workstation to become non-compliant."
                      : "Standard system baseline verification check."
                    }
                  </p>
                </div>

                {selectedFinding.policy_name && (
                  <div>
                    <span className="block text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-sans mb-1">Associated Baseline Policy</span>
                    <p className="text-sm font-semibold text-on-surface font-sans">{selectedFinding.policy_name}</p>
                    {selectedFinding.policy_id && <span className="block text-xs font-mono text-on-surface-variant/70 mt-1 select-all">{selectedFinding.policy_id}</span>}
                  </div>
                )}

                <div>
                  <span className="block text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-sans mb-1.5">Failure Reason / Context</span>
                  <p className="text-xs text-on-surface font-sans bg-terminal-black/80 border border-outline-variant/60 rounded-xl p-4.5 leading-relaxed whitespace-pre-wrap leading-loose">
                    {selectedFinding.reason || "No detail provided by security telemetry daemon."}
                  </p>
                </div>

                {/* Date stamps grid */}
                <div className="grid grid-cols-2 gap-4 pt-1 text-xs">
                  <div>
                    <span className="block text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-sans mb-0.5">First Detected</span>
                    <p className="text-on-surface font-sans" title={new Date(selectedFinding.first_detected_at).toLocaleString()}>
                      {new Date(selectedFinding.first_detected_at).toLocaleDateString()} {new Date(selectedFinding.first_detected_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-sans mb-0.5">Last Seen / Evaluated</span>
                    <p className="text-on-surface font-sans" title={new Date(selectedFinding.last_detected_at).toLocaleString()}>
                      {new Date(selectedFinding.last_detected_at).toLocaleDateString()} {new Date(selectedFinding.last_detected_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                </div>

                {/* Resolution Details */}
                {selectedFinding.status === "RESOLVED" && (
                  <div className="pt-3 space-y-3">
                    <hr className="border-outline-variant/40" />
                    <div>
                      <span className="block text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-sans mb-1.5">Archived Resolution Detail</span>
                      <p className="text-xs text-on-surface font-sans bg-[#11241a] border border-status-success/30 rounded-xl p-4 leading-relaxed">
                        {selectedFinding.resolution_reason || "Violation successfully mitigated, config baseline check PASS."}
                      </p>
                    </div>
                    {selectedFinding.resolved_at && (
                      <div>
                        <span className="block text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider font-sans mb-0.5">Archived Timestamp</span>
                        <p className="text-xs text-on-surface font-sans" title={new Date(selectedFinding.resolved_at).toLocaleString()}>
                          {new Date(selectedFinding.resolved_at).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions Panel Footer */}
            <div className="p-6 border-t border-outline-variant bg-[#111115] flex items-center space-x-4 select-none">
              <button
                onClick={() => {
                  setDrawerOpen(false)
                  router.push(`/devices/${selectedFinding.device_id}`)
                }}
                className="flex-1 inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#2D8C74] hover:bg-[#257360] text-white transition-colors"
              >
                View Workstation
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-outline-variant text-on-surface-variant hover:text-white hover:bg-surface-container-high transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
