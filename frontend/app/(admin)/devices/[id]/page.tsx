"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { 
  ArrowLeft, Laptop, ShieldCheck, ShieldAlert, Activity, Calendar, CheckCircle2, XCircle, ChevronDown, ChevronUp 
} from "lucide-react"
import { 
  PageHeader, SectionHeader, Panel, TerminalPanel, StatusBadge, SeverityBadge, LoadingState, EmptyState 
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
  const [showResolved, setShowResolved] = useState(false)

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

  // Get remediation command snippet
  const getRemediation = (ruleName: string, os: string) => {
    const isArch = os.toLowerCase().includes("arch")
    const isDebian = os.toLowerCase().includes("ubuntu") || os.toLowerCase().includes("debian")

    switch (ruleName.toLowerCase()) {
      case "firewall":
        return "sudo ufw enable || sudo systemctl enable --now firewalld"
      case "ssh":
        return "sudo systemctl disable --now sshd || sudo systemctl disable --now ssh"
      case "updates":
        if (isArch) return "sudo pacman -Syu"
        if (isDebian) return "sudo apt-get update && sudo apt-get upgrade -y"
        return "sudo dnf upgrade -y"
      case "node":
        return "nvm install 22 && nvm use 22"
      case "docker":
        if (isArch) return "sudo pacman -S docker && sudo systemctl enable --now docker"
        if (isDebian) return "sudo apt-get install docker.io -y"
        return "sudo dnf install docker -y"
      default:
        return "# Consult system security compliance manual for fix actions"
    }
  }

  // Map raw drift type enums to readable labels
  const getDriftLabel = (driftType: string | null) => {
    if (driftType === "DEVICE_DRIFT") return "Device drift"
    if (driftType === "POLICY_CHANGE_NON_COMPLIANCE") return "Policy change"
    return "Initial check failure"
  }

  // Map resolution reasons to readable labels
  const getResolutionLabel = (reason: string | null) => {
    if (reason === "REMEDIATED") return "Remediated"
    if (reason === "POLICY_RULE_REMOVED") return "Policy rule removed"
    if (reason === "POLICY_REASSIGNED") return "Policy reassigned"
    return reason || "Resolved"
  }

  // Map raw provenance_status enums to readable alignment status
  const getAlignmentStatus = (status: string | null) => {
    if (status === "CURRENT") return "Compliant"
    if (status === "OUTDATED_POLICY") return "Update pending"
    if (status === "POLICY_UNAVAILABLE") return "Policy unavailable"
    return "Unknown"
  }

  if (loading) {
    return <LoadingState message="Retrieving workstation security posture..." />
  }

  if (error || !device) {
    return (
      <div className="space-y-4 font-sans text-xs">
        <div className="p-4 rounded-xl border border-red-950 bg-red-950/10 text-error">
          {error || "Workstation profile not found."}
        </div>
        <Link href="/dashboard" className="inline-flex items-center space-x-1 font-bold text-tertiary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to dashboard</span>
        </Link>
      </div>
    )
  }

  // Chronologically merge events and checkruns
  const timelineItems = [
    ...history.map(item => ({
      id: `ev-${item.id}`,
      type: "event",
      timestamp: item.timestamp,
      message: item.message,
      eventType: item.type,
      ruleName: item.rule_name,
    })),
    ...checkRuns.map(run => ({
      id: `run-${run.id}`,
      type: "check_run",
      timestamp: run.timestamp,
      message: `Workstation Posture Score Evaluated: ${run.score}/100 (${run.status === "PASS" ? "Compliant" : "Failing"})`,
      score: run.score,
      status: run.status,
      policyName: run.policy_name,
      versionNumber: run.version_number,
    }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans">
      
      {/* Page navigation & title header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-outline-variant/60">
        <div className="space-y-2">
          <Link href="/dashboard" className="inline-flex items-center space-x-1.5 text-xs text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </Link>
          <div className="flex items-center space-x-3 flex-wrap gap-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">{device.hostname}</h1>
            <span
              className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                device.status === "ONLINE"
                  ? "bg-status-success/10 text-status-success border-status-success/20"
                  : "bg-surface-container-high text-on-surface-variant border-outline-variant"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${device.status === "ONLINE" ? "bg-status-success" : "bg-on-surface-variant/40"}`}></span>
              <span className="font-mono text-[10px] uppercase font-bold">{device.status === "ONLINE" ? "Online" : "Offline"}</span>
            </span>
            {device.status !== "DECOMMISSIONED" && (
              <button
                onClick={handleRevoke}
                className="px-2.5 py-1 bg-error/10 hover:bg-error/20 text-error text-[10px] font-bold rounded-lg border border-error/20 transition-colors"
              >
                Revoke Device
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-mono">Posture Score</p>
            <p className="text-2xl font-bold font-mono tracking-tight mt-0.5 text-on-surface">
              <span className={device.compliance_score >= 90 ? "text-status-success" : device.compliance_score >= 70 ? "text-warning" : "text-error"}>
                {device.compliance_score}/100
              </span>
            </p>
          </div>
          <StatusBadge status={device.compliance_status} />
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: Specifications & Policy Alignment */}
        <div className="space-y-6 lg:col-span-1">
          {/* Specifications Card */}
          <div className="space-y-4">
            <SectionHeader title="Specifications" icon={Laptop} />
            <Panel className="p-5">
              <div className="space-y-3.5 text-xs">
                <div>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-mono">UUID</p>
                  <p className="font-mono text-on-surface mt-1 truncate select-all">{device.id}</p>
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-mono">Operating System</p>
                  <p className="font-bold text-on-surface mt-1">{device.os_name} {device.os_version}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-mono">Architecture</p>
                    <p className="font-bold text-on-surface mt-1">{device.os_arch}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-mono">Agent</p>
                    <p className="font-mono font-bold text-on-surface mt-1">{device.agent_version}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-mono">Kernel Version</p>
                  <p className="font-mono text-on-surface mt-1 truncate">{device.kernel_version}</p>
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-mono">Last Active Handshake</p>
                  <p className="font-semibold text-on-surface-variant mt-1">
                    {device.last_checkin ? new Date(device.last_checkin).toLocaleString() : "never"}
                  </p>
                </div>
              </div>
            </Panel>
          </div>

          {/* Policy Alignment Card */}
          <div className="space-y-4">
            <SectionHeader title="Policy Alignment" icon={ShieldCheck} />
            <Panel className="p-5">
              <div className="space-y-4 text-xs">
                <div>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-mono">Desired Baseline</p>
                  <p className="font-bold text-on-surface mt-1">
                    {effectivePolicy ? `${effectivePolicy.name} (v${effectivePolicy.active_version_number || "Draft"})` : "None Assigned"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-mono">Last Evaluated Baseline</p>
                  <p className="font-bold text-on-surface mt-1">
                    {latestRun?.policy_name ? `${latestRun.policy_name} (v${latestRun.version_number || "?"})` : "None"}
                  </p>
                </div>
                
                <div className="pt-2 border-t border-outline-variant/40">
                  <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-mono mb-2">Sync Status</p>
                  <StatusBadge status={getAlignmentStatus(latestRun?.provenance_status || null)} />
                  <p className="text-[9px] font-mono text-on-surface-variant/80 mt-1.5">
                    Context: {latestRun?.provenance_status || "UNKNOWN"}
                  </p>
                </div>

                {latestRun?.content_hash && (
                  <div>
                    <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-mono">Evaluated Hash</p>
                    <p className="text-[9px] font-mono text-on-surface-variant mt-1.5 break-all bg-surface-container-low p-2 border border-outline-variant/40 rounded-lg">
                      {latestRun.content_hash}
                    </p>
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </div>

        {/* RIGHT COLUMN: Active Findings, Resolved Findings, Timeline */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active findings */}
          <div className="space-y-4">
            <SectionHeader title="Active Security Findings" />
            <Panel>
              <div className="divide-y divide-outline-variant/30">
                {openFindings.length === 0 ? (
                  <div className="p-8 text-center text-on-surface-variant text-xs flex flex-col items-center justify-center space-y-2">
                    <ShieldCheck className="h-8 w-8 text-status-success" />
                    <p className="font-bold text-on-surface">No active violations</p>
                    <p className="text-[10px]">This workstation is fully compliant with the assigned posture policy baseline.</p>
                  </div>
                ) : (
                  openFindings.map((finding) => (
                    <div key={finding.id} className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="font-bold text-sm text-on-surface">{finding.check_name}</span>
                            <SeverityBadge severity={finding.severity} />
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border border-outline-variant/60 bg-surface-container-low text-on-surface-variant font-mono">
                              {getDriftLabel(finding.drift_type)}
                            </span>
                          </div>
                          <p className="text-xs text-on-surface-variant">{finding.reason || "Violated baseline requirement rules."}</p>
                          <p className="text-[9px] text-on-surface-variant/80 font-mono">
                            Rule: {finding.rule_id} · Detected: {new Date(finding.first_detected_at).toLocaleString()}
                          </p>
                        </div>
                        <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-error/15 text-error border border-error/30 font-mono">
                          FAIL
                        </span>
                      </div>

                      {/* Remediation code block */}
                      <TerminalPanel 
                        title="Remediation Copy-Paste Fix" 
                        content={getRemediation(finding.rule_id, device.os_name)}
                      />
                    </div>
                  ))
                )}
              </div>
            </Panel>
          </div>

          {/* Historical resolved findings - Collapsible */}
          <div className="space-y-2">
            <Panel>
              <button
                onClick={() => setShowResolved(!showResolved)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-container-high/20 transition-colors text-left"
              >
                <div className="flex items-center space-x-2">
                  <ShieldCheck className="h-4 w-4 text-status-success" />
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface font-mono">Historical Resolved Findings</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-[10px] text-on-surface-variant font-bold bg-surface-container-high px-2 py-0.5 rounded border border-outline-variant/40">
                    Archived: {resolvedFindings.length}
                  </span>
                  {showResolved ? <ChevronUp className="h-4 w-4 text-on-surface-variant" /> : <ChevronDown className="h-4 w-4 text-on-surface-variant" />}
                </div>
              </button>

              {showResolved && (
                <div className="p-5 border-t border-outline-variant/35">
                  {resolvedFindings.length === 0 ? (
                    <p className="text-[10px] text-on-surface-variant text-center py-4">No resolved checks recorded for this device.</p>
                  ) : (
                    <div className="overflow-x-auto border border-outline-variant/50 rounded-xl bg-surface-container-low">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-outline-variant bg-surface-container-low/60 font-semibold text-on-surface-variant font-mono uppercase tracking-wider">
                            <th className="px-4 py-2.5">Rule / Check</th>
                            <th className="px-4 py-2.5">Drift Type</th>
                            <th className="px-4 py-2.5">Resolution</th>
                            <th className="px-4 py-2.5">Resolved Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/30 text-on-surface font-sans">
                          {resolvedFindings.map((f) => (
                            <tr key={f.id} className="hover:bg-surface-container-high/10">
                              <td className="px-4 py-3 font-semibold text-on-surface">{f.check_name}</td>
                              <td className="px-4 py-3 text-on-surface-variant font-mono text-[10px]">
                                {f.drift_type ? getDriftLabel(f.drift_type) : "Initial"}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                  f.resolution_reason === "REMEDIATED" ? "bg-status-success/15 text-status-success border-status-success/30" :
                                  f.resolution_reason === "POLICY_RULE_REMOVED" ? "bg-surface-container-high text-on-surface-variant border-outline-variant" :
                                  "bg-tertiary/15 text-tertiary border-tertiary/30"
                                }`}>
                                  {getResolutionLabel(f.resolution_reason)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-on-surface-variant font-mono text-[10px]">
                                {f.resolved_at ? new Date(f.resolved_at).toLocaleString() : ""}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Panel>
          </div>

          {/* Unified Timeline */}
          <div className="space-y-4">
            <SectionHeader title="Unified Posture & Compliance Timeline" icon={Calendar} />
            <Panel className="p-6">
              {timelineItems.length === 0 ? (
                <p className="text-xs text-on-surface-variant text-center py-4">No events recorded for this device.</p>
              ) : (
                <div className="relative border-l border-outline-variant/60 ml-2 pl-6 space-y-6">
                  {timelineItems.map((item) => {
                    const dateStr = new Date(item.timestamp).toLocaleString()

                    if (item.type === "event") {
                      const isTrigger = (item as any).eventType === "VIOLATION_TRIGGERED"
                      return (
                        <div key={item.id} className="relative">
                          <span className="absolute -left-[30px] top-0 bg-surface rounded-full p-0.5 border border-outline-variant/60">
                            {isTrigger ? (
                              <XCircle className="h-3.5 w-3.5 text-error flex-shrink-0" />
                            ) : (
                              <CheckCircle2 className="h-3.5 w-3.5 text-status-success flex-shrink-0" />
                            )}
                          </span>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-on-surface leading-none">
                              {isTrigger ? "Violation Triggered" : "Violation Resolved"}
                            </p>
                            <p className="text-[11px] text-on-surface-variant mt-1">{item.message}</p>
                            <p className="text-[9px] text-on-surface-variant/70 font-mono mt-1 leading-none">{dateStr}</p>
                          </div>
                        </div>
                      )
                    } else {
                      // check_run
                      const score = (item as any).score
                      const pName = (item as any).policyName
                      const vNum = (item as any).versionNumber
                      const scoreColor = score >= 90 ? "text-status-success" : score >= 70 ? "text-warning" : "text-error"

                      return (
                        <div key={item.id} className="relative">
                          <span className="absolute -left-[30px] top-0 bg-surface rounded-full p-0.5 border border-outline-variant/60">
                            <Activity className="h-3.5 w-3.5 text-on-surface-variant/60 flex-shrink-0" />
                          </span>
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-on-surface leading-none">
                              Posture Evaluated · Score <span className={`font-mono font-bold ${scoreColor}`}>{score}/100</span>
                            </p>
                            <p className="text-[11px] text-on-surface-variant mt-1">
                              Evaluated policy {pName ? `"${pName}" (v${vNum || "?"})` : "definition"}
                            </p>
                            <p className="text-[9px] text-on-surface-variant/70 font-mono mt-1 leading-none">{dateStr}</p>
                          </div>
                        </div>
                      )
                    }
                  })}
                </div>
              )}
            </Panel>
          </div>

        </div>

      </div>
    </div>
  )
}
