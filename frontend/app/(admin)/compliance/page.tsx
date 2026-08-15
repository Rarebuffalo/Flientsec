"use client"

import React, { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import {
  ShieldCheck, ShieldAlert, AlertTriangle, Search, Filter,
  Copy, Check, ExternalLink, RefreshCw, Layers, Lock, Cpu, X,
  Clock, Hash, FileCheck, CheckCircle2, XCircle, AlertOctagon
} from "lucide-react"
import {
  StatCard, PageHeader, LoadingState, EmptyState, SeverityBadge
} from "../../../components/ui"

interface ComplianceSummary {
  overall_score: number
  compliance_status: string
  devices: {
    total: number
    compliant: number
    failing: number
    unknown: number
  }
  controls: {
    total: number
    compliant: number
    failing: number
  }
  critical_failures: number
  stale_devices: number
  calculated_at: string
}

interface ControlPosture {
  id?: string
  control_id: string
  name: string
  description: string
  category: string
  severity: string
  mapped_rule_id: string
  passed_devices: number
  failed_devices: number
  unknown_devices?: number
  compliance_percentage: number
  status: string
}

interface FailingDevice {
  id: string
  hostname: string
  os_name: string
  os_version: string
  compliance_status: string
  compliance_score: number
  last_checkin: string | null
}

interface ControlDetail {
  control: {
    id: string
    control_id: string
    name: string
    description: string
    category: string
    severity: string
    mapped_rule_id: string
  }
  posture: ControlPosture
  failing_devices: FailingDevice[]
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

interface EvidenceListResponse {
  total: number
  limit: number
  offset: number
  items: EvidenceItem[]
}

export default function CompliancePage() {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null)
  const [controls, setControls] = useState<ControlPosture[]>([])
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>([])
  const [evidenceTotal, setEvidenceTotal] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Drawer / Modal state for Control Detail
  const [selectedControlId, setSelectedControlId] = useState<string | null>(null)
  const [controlDetail, setControlDetail] = useState<ControlDetail | null>(null)
  const [loadingControlDetail, setLoadingControlDetail] = useState(false)

  // Evidence filtering states
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [controlFilter, setControlFilter] = useState<string>("ALL")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const fetchComplianceData = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true)
      else setLoading(true)

      const token = localStorage.getItem("flientsec_token")
      if (!token) {
        window.location.href = "/login"
        return
      }
      const headers = { Authorization: `Bearer ${token}` }

      // 1. Fetch Fleet Compliance Summary
      const sumRes = await fetch(`${apiUrl}/api/v1/compliance/summary`, { headers })
      if (!sumRes.ok) throw new Error("Failed to load compliance summary")
      const sumData = await sumRes.json()
      setSummary(sumData)

      // 2. Fetch Compliance Controls Posture
      const ctrlRes = await fetch(`${apiUrl}/api/v1/compliance/controls`, { headers })
      if (!ctrlRes.ok) throw new Error("Failed to load compliance controls")
      const ctrlData = await ctrlRes.json()
      setControls(ctrlData)

      // 3. Fetch Fleet Evidence Audit Trail
      let evUrl = `${apiUrl}/api/v1/compliance/evidence?limit=50`
      if (statusFilter !== "ALL") evUrl += `&status=${statusFilter}`
      if (controlFilter !== "ALL") evUrl += `&control_id=${controlFilter}`

      const evRes = await fetch(evUrl, { headers })
      if (evRes.ok) {
        const evData: EvidenceListResponse = await evRes.json()
        setEvidenceList(evData.items)
        setEvidenceTotal(evData.total)
      }

      setError(null)
    } catch (err: any) {
      setError(err.message || "Failed to load compliance posture data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchComplianceData()
  }, [statusFilter, controlFilter])

  const openControlModal = async (controlId: string) => {
    setSelectedControlId(controlId)
    setLoadingControlDetail(true)
    try {
      const token = localStorage.getItem("flientsec_token")
      const headers = { Authorization: `Bearer ${token}` }
      const res = await fetch(`${apiUrl}/api/v1/compliance/controls/${controlId}`, { headers })
      if (res.ok) {
        const detail: ControlDetail = await res.json()
        setControlDetail(detail)
      }
    } catch (err) {
      console.error("Failed to load control detail", err)
    } finally {
      setLoadingControlDetail(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedHash(id)
    setTimeout(() => setCopiedHash(null), 2000)
  }

  // Filter evidence locally by search query (hostname or hash)
  const filteredEvidence = useMemo(() => {
    if (!searchQuery.trim()) return evidenceList
    const q = searchQuery.toLowerCase().trim()
    return evidenceList.filter(
      (ev) =>
        ev.hostname.toLowerCase().includes(q) ||
        ev.evidence_hash.toLowerCase().includes(q) ||
        ev.rule_id.toLowerCase().includes(q)
    )
  }, [evidenceList, searchQuery])

  if (loading && !summary) {
    return <LoadingState message="Calculating fleet compliance posture..." />
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Fleet Compliance & Evidence"
        subtitle="Continuous posture verification, compliance controls, and tamper-evident audit evidence."
        actions={
          <button
            onClick={() => fetchComplianceData(true)}
            disabled={refreshing}
            className="btn btn-secondary btn-sm flex items-center space-x-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Recalculating..." : "Refresh Posture"}</span>
          </button>
        }
      />

      {error && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 flex items-center space-x-3 text-danger text-sm">
          <AlertOctagon className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Fleet Posture Overview Stat Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="panel p-5 flex flex-col justify-between border-l-4 border-l-brand">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-text-muted">Fleet Score</div>
              <div className="text-3xl font-extrabold font-mono text-text-primary mt-1">
                {summary.overall_score}%
              </div>
            </div>
            <div className="mt-3 flex items-center space-x-2">
              <span className={`badge ${summary.overall_score >= 80 ? "badge-compliant" : summary.overall_score >= 50 ? "badge-warning" : "badge-failing"}`}>
                <span className="dot"></span>
                {summary.compliance_status}
              </span>
            </div>
          </div>

          <StatCard
            label="Compliant Devices"
            value={`${summary.devices.compliant} / ${summary.devices.total}`}
            subtext={`${summary.devices.total > 0 ? Math.round((summary.devices.compliant / summary.devices.total) * 100) : 100}% of active fleet`}
          />

          <div className="panel p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-text-muted">Failing Devices</div>
              <div className="text-3xl font-extrabold font-mono text-danger mt-1">
                {summary.devices.failing}
              </div>
            </div>
            <div className="text-xs text-text-muted mt-3">
              {summary.devices.unknown > 0 ? `${summary.devices.unknown} unknown / unregistered` : "Evaluated against active policies"}
            </div>
          </div>

          <div className="panel p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-text-muted">Critical Violations</div>
              <div className={`text-3xl font-extrabold font-mono mt-1 ${summary.critical_failures > 0 ? "text-danger" : "text-text-primary"}`}>
                {summary.critical_failures}
              </div>
            </div>
            <div className="text-xs text-text-muted mt-3">
              High / Critical severity failures
            </div>
          </div>

          <div className="panel p-5 flex flex-col justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-text-muted">Stale Devices</div>
              <div className={`text-3xl font-extrabold font-mono mt-1 ${summary.stale_devices > 0 ? "text-amber-400" : "text-text-primary"}`}>
                {summary.stale_devices}
              </div>
            </div>
            <div className="text-xs text-text-muted mt-3">
              &gt; 1h telemetry silence
            </div>
          </div>
        </div>
      )}

      {/* 2. Standard Compliance Controls Breakdown */}
      <div className="panel overflow-hidden">
        <div className="px-5 py-4 border-b border-border-soft flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Layers className="h-5 w-5 text-brand" />
            <div>
              <h2 className="text-sm font-bold text-text-primary">Compliance Controls Posture</h2>
              <p className="text-xs text-text-muted">Status of mapped workstation security baseline controls</p>
            </div>
          </div>
          <span className="text-xs font-mono text-text-muted">
            {controls.filter((c) => c.status === "PASS" || c.status === "COMPLIANT").length} of {controls.length} Passing
          </span>
        </div>

        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="w-[120px]">Control ID</th>
                <th className="min-w-[200px]">Control Name</th>
                <th className="w-[130px]">Category</th>
                <th className="w-[90px]">Severity</th>
                <th className="w-[150px]">Mapped Rule</th>
                <th className="w-[80px] text-center">Passing</th>
                <th className="w-[80px] text-center">Failing</th>
                <th className="w-[110px] text-center">Score</th>
                <th className="w-[110px] text-center">Status</th>
                <th className="w-[90px] text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {controls.map((ctrl) => {
                const isPassing = ctrl.status === "PASS" || ctrl.status === "COMPLIANT"
                const score = ctrl.compliance_percentage ?? 0
                return (
                  <tr key={ctrl.control_id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="font-mono font-bold text-brand text-xs whitespace-nowrap">
                      {ctrl.control_id}
                    </td>
                    <td>
                      <div className="font-semibold text-text-primary text-xs">{ctrl.name}</div>
                      <div className="text-[11px] text-text-muted truncate max-w-xs" title={ctrl.description}>{ctrl.description}</div>
                    </td>
                    <td className="text-xs text-text-secondary whitespace-nowrap">{ctrl.category}</td>
                    <td>
                      <SeverityBadge severity={ctrl.severity} />
                    </td>
                    <td className="font-mono text-[11px] text-text-muted truncate max-w-[150px]" title={ctrl.mapped_rule_id}>
                      {ctrl.mapped_rule_id}
                    </td>
                    <td className="text-center font-mono text-xs text-brand font-semibold">
                      {ctrl.passed_devices ?? 0}
                    </td>
                    <td className={`text-center font-mono text-xs font-semibold ${(ctrl.failed_devices ?? 0) > 0 ? "text-danger" : "text-text-muted"}`}>
                      {ctrl.failed_devices ?? 0}
                    </td>
                    <td className="text-center">
                      <div className="inline-flex items-center space-x-2">
                        <div className="w-12 bg-surface-2 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full ${score >= 80 ? "bg-brand" : score >= 50 ? "bg-amber-400" : "bg-danger"}`}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-bold text-text-primary">{score}%</span>
                      </div>
                    </td>
                    <td className="text-center">
                      <span className={`badge ${isPassing ? "badge-compliant" : "badge-failing"}`}>
                        <span className="dot"></span>
                        {isPassing ? "Compliant" : "Violations"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => openControlModal(ctrl.control_id)}
                        className="btn btn-ghost btn-xs text-brand hover:text-white"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Tamper-Evident Evidence Audit Trail */}
      <div className="panel overflow-hidden">
        <div className="px-5 py-4 border-b border-border-soft flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <FileCheck className="h-5 w-5 text-brand" />
            <div>
              <h2 className="text-sm font-bold text-text-primary">Tamper-Evident Audit Evidence</h2>
              <p className="text-xs text-text-muted">Deterministic SHA-256 integrity logs generated upon every check-in</p>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                placeholder="Search host or hash..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-sm pl-8 text-xs w-48 bg-surface-2 border-border-soft"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select select-sm text-xs bg-surface-2 border border-border-soft"
            >
              <option value="ALL">All Statuses</option>
              <option value="PASS">Pass Only</option>
              <option value="FAIL">Fail Only</option>
            </select>

            <select
              value={controlFilter}
              onChange={(e) => setControlFilter(e.target.value)}
              className="select select-sm text-xs bg-surface-2 border border-border-soft"
            >
              <option value="ALL">All Controls</option>
              <option value="FLIENT-001">FLIENT-001 (Firewall)</option>
              <option value="FLIENT-002">FLIENT-002 (Disk)</option>
              <option value="FLIENT-003">FLIENT-003 (Screen Lock)</option>
              <option value="FLIENT-004">FLIENT-004 (OS Version)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th className="w-[180px]">Evaluated At</th>
                <th className="w-[140px]">Device</th>
                <th className="w-[110px]">Control ID</th>
                <th className="w-[160px]">Rule ID</th>
                <th className="w-[90px] text-center">Status</th>
                <th className="w-[90px] text-center">Severity</th>
                <th className="min-w-[180px]">Observed Result</th>
                <th className="w-[160px] text-right">Evidence SHA-256 Hash</th>
              </tr>
            </thead>
            <tbody>
              {evidenceTotal === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <FileCheck className="h-8 w-8 text-text-muted mb-2 mx-auto" />
                    <div className="text-sm font-semibold text-text-primary">No compliance evidence recorded yet</div>
                    <div className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                      Evidence records are generated automatically upon workstation check-ins and policy evaluations.
                    </div>
                  </td>
                </tr>
              ) : filteredEvidence.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-text-muted text-xs">
                    No evidence records matching current search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredEvidence.map((ev) => (
                  <tr key={ev.id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="font-mono text-xs text-text-secondary whitespace-nowrap">
                      {new Date(ev.evaluation_timestamp).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      })}
                    </td>
                    <td>
                      <Link
                        href={`/devices/${ev.device_id}`}
                        className="font-medium text-text-primary hover:text-brand flex items-center space-x-1 text-xs"
                      >
                        <span className="truncate max-w-[120px]" title={ev.hostname}>{ev.hostname}</span>
                        <ExternalLink className="h-3 w-3 opacity-60 flex-shrink-0" />
                      </Link>
                    </td>
                    <td className="font-mono font-bold text-xs text-brand">
                      {ev.control_id}
                    </td>
                    <td className="font-mono text-[11px] text-text-muted truncate max-w-[140px]" title={ev.rule_id}>
                      {ev.rule_id}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${ev.status === "PASS" ? "badge-compliant" : "badge-failing"}`}>
                        <span className="dot"></span>
                        {ev.status}
                      </span>
                    </td>
                    <td className="text-center">
                      <SeverityBadge severity={ev.severity} />
                    </td>
                    <td className="font-mono text-[11px] text-text-muted truncate max-w-xs" title={ev.observed_result}>
                      {ev.observed_result}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center space-x-1.5 font-mono text-[11px] text-brand">
                        <span title={ev.evidence_hash} className="truncate max-w-[110px]">
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
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-border-soft flex items-center justify-between text-xs text-text-muted">
          <span>Showing {filteredEvidence.length} of {evidenceTotal} total evidence records</span>
          <span className="font-mono">Audit Window: 90 Days</span>
        </div>
      </div>

      {/* Control Detail / Failing Devices Modal */}
      {selectedControlId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand font-mono font-bold text-sm">
                  {selectedControlId.split("-")[1]}
                </div>
                <div>
                  <h3 className="font-bold text-base text-text-primary">
                    {controlDetail?.control.name || `Control ${selectedControlId}`}
                  </h3>
                  <p className="text-xs text-text-muted font-mono">{selectedControlId}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedControlId(null)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-surface-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {loadingControlDetail ? (
                <LoadingState message="Loading control details and failing devices..." />
              ) : controlDetail ? (
                <>
                  {/* Control Metadata */}
                  <div className="grid grid-cols-2 gap-3 bg-surface-2/60 p-3.5 rounded-lg border border-border text-xs">
                    <div>
                      <span className="text-text-muted block font-semibold">Category:</span>
                      <span className="text-text-primary font-medium">{controlDetail.control.category}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block font-semibold">Severity:</span>
                      <SeverityBadge severity={controlDetail.control.severity} />
                    </div>
                    <div className="col-span-2">
                      <span className="text-text-muted block font-semibold">Mapped Policy Rule:</span>
                      <span className="font-mono text-text-secondary">{controlDetail.control.mapped_rule_id}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-text-muted block font-semibold">Description:</span>
                      <span className="text-text-secondary leading-relaxed">{controlDetail.control.description}</span>
                    </div>
                  </div>

                  {/* Failing Devices Section */}
                  <div>
                    <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span>Failing Devices ({controlDetail.failing_devices.length})</span>
                      <span className="text-text-muted font-normal">Requires Remediation</span>
                    </h4>

                    {controlDetail.failing_devices.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-border rounded-lg bg-surface-2/20">
                        <CheckCircle2 className="h-7 w-7 text-brand mx-auto mb-2" />
                        <div className="text-xs font-semibold text-text-primary">100% Compliant</div>
                        <div className="text-[11px] text-text-muted mt-0.5">No devices are currently failing this control.</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {controlDetail.failing_devices.map((dev) => (
                          <div
                            key={dev.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-danger/20 bg-danger/5 hover:bg-danger/10 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <Link
                                  href={`/devices/${dev.id}`}
                                  className="text-xs font-bold text-text-primary hover:text-brand flex items-center space-x-1"
                                >
                                  <span>{dev.hostname}</span>
                                  <ExternalLink className="h-3 w-3 opacity-60" />
                                </Link>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 bg-surface-2 rounded text-text-muted">
                                  {dev.os_name} {dev.os_version}
                                </span>
                              </div>
                              <div className="text-[11px] text-text-muted mt-0.5">
                                Last active: {dev.last_checkin ? new Date(dev.last_checkin).toLocaleString() : "Never"}
                              </div>
                            </div>
                            <div className="text-right flex items-center space-x-2">
                              <span className="font-mono text-xs font-bold text-danger">{dev.compliance_score}%</span>
                              <Link
                                href={`/devices/${dev.id}`}
                                className="btn btn-secondary btn-xs"
                              >
                                View Device
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedControlId(null)}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
