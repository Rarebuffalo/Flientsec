"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { ShieldCheck, Laptop, RefreshCw, Download, AlertTriangle, ShieldAlert } from "lucide-react"
import { 
  PageHeader, StatCard, SectionHeader, LoadingState, EmptyState, Panel, StatusBadge 
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

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([])
  const [policy, setPolicy] = useState<any>(null)
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

  // 1. Authoritative Frontend Calculations
  const totalCount = devices.length
  const compliantCount = devices.filter((d) => d.compliance_status === "PASS").length
  const warningCount = devices.filter((d) => d.compliance_status === "WARN").length
  const failedCount = devices.filter((d) => d.compliance_status === "FAIL").length
  
  // Posture Percentage Score
  const fleetPostureScore = totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 100

  // Devices requiring action
  const attentionDevices = devices.filter(
    (d) => d.compliance_status !== "PASS" || d.status !== "ONLINE"
  )
  const attentionCount = attentionDevices.length

  // Policy references
  const hasActivePolicy = policy && policy.active_version_id
  const activePolicyName = policy ? policy.name : "None Assigned"
  const activePolicyVer = hasActivePolicy ? `Active v${policy.active_version_number}` : "No active baseline"

  if (loading) {
    return <LoadingState message="Retrieving fleet security posture..." />
  }

  if (error) {
    return (
      <div className="space-y-6 font-sans">
        <PageHeader 
          title="Dashboard" 
          subtitle="Continuous security posture across your engineering workstations." 
        />
        <div className="p-4 rounded-xl border border-red-200 bg-red-50/10 text-xs text-red-400 flex items-center space-x-2 font-mono">
          <ShieldAlert className="h-4 w-4 flex-shrink-0 text-red-500" />
          <span>{error} (Ensure backend service is accessible at {apiUrl})</span>
        </div>
        <button 
          onClick={() => setRefreshKey((prev) => prev + 1)}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-lg text-xs font-bold text-on-surface transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Retry Connection</span>
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans">
      {/* Header action bar */}
      <PageHeader 
        title="Dashboard" 
        subtitle="Continuous security posture across your engineering workstations." 
        actions={
          <div className="flex items-center space-x-2">
            <button
              onClick={exportReport}
              title="Export CSV Report"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-lg text-xs font-bold text-on-surface transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-on-surface-variant" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => setRefreshKey((prev) => prev + 1)}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-lg text-xs font-bold text-on-surface transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5 text-on-surface-variant" />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* SECTION 1 — FLEET SUMMARY STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Fleet Posture" 
          value={`${fleetPostureScore}%`} 
          subtext={fleetPostureScore === 100 ? "Fully Compliant" : "Needs Attention"} 
          status={fleetPostureScore === 100 ? "PASS" : "WARN"}
        />
        <StatCard 
          label="Enrolled Workstations" 
          value={totalCount} 
          subtext={`${devices.filter((d) => d.status === "ONLINE").length} currently online`} 
        />
        <StatCard 
          label="Attention Required" 
          value={attentionCount} 
          subtext={`${failedCount} failed · ${warningCount} warnings`} 
          status={attentionCount > 0 ? "FAIL" : "PASS"}
        />
        <StatCard 
          label="Policy Baseline" 
          value={activePolicyVer} 
          subtext={activePolicyName} 
          status={hasActivePolicy ? "PASS" : "WARN"}
        />
      </div>

      {/* Main operational sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* SECTION 2 — ATTENTION REQUIRED (Left 2 columns on desktop) */}
        <div className="lg:col-span-2 space-y-4">
          <SectionHeader title="Attention Required" />
          
          {attentionCount === 0 ? (
            <EmptyState 
              title="No workstations require attention" 
              description="All enrolled devices successfully comply with the current baseline security policy." 
              icon={ShieldCheck} 
            />
          ) : (
            <Panel>
              <div className="divide-y divide-outline-variant/30">
                {attentionDevices.map((device) => {
                  const isStale = device.status !== "ONLINE"
                  const lastActive = device.last_checkin 
                    ? new Date(device.last_checkin).toLocaleString() 
                    : "never"
                  
                  return (
                    <div 
                      key={device.id} 
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-container-high/20 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="font-mono font-bold text-sm text-on-surface">{device.hostname}</span>
                          <StatusBadge status={device.compliance_status} />
                          {isStale && (
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border border-warning/20 bg-warning/10 text-warning font-mono">
                              STALE/OFFLINE
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-on-surface-variant font-mono">
                          ID: {device.id} · Check-in: {lastActive}
                        </p>
                      </div>

                      <div className="flex items-center space-x-4 self-end sm:self-auto">
                        <div className="text-right">
                          <p className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wider font-mono">Score</p>
                          <p className="text-sm font-bold font-mono text-on-surface">{device.compliance_score}/100</p>
                        </div>
                        <Link 
                          href={`/devices/${device.id}`}
                          className="px-3 py-1.5 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/60 rounded-lg text-xs font-bold text-on-surface transition-colors"
                        >
                          View Device →
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>
          )}
        </div>

        {/* SECTION 3 & 4 — FLEET STATE & POLICY ALIGNMENT (Right 1 column) */}
        <div className="space-y-6">
          {/* Posture Distribution */}
          <div className="space-y-4">
            <SectionHeader title="Posture Distribution" />
            <Panel className="p-5 space-y-4">
              {/* Simple distribution bar */}
              {totalCount > 0 ? (
                <div className="h-2 rounded-full overflow-hidden flex bg-surface-container-low border border-outline-variant/40">
                  <div 
                    style={{ width: `${(compliantCount / totalCount) * 100}%` }} 
                    className="bg-status-success"
                    title={`Compliant: ${compliantCount}`}
                  />
                  <div 
                    style={{ width: `${(warningCount / totalCount) * 100}%` }} 
                    className="bg-warning"
                    title={`Warnings: ${warningCount}`}
                  />
                  <div 
                    style={{ width: `${(failedCount / totalCount) * 100}%` }} 
                    className="bg-error"
                    title={`Failed: ${failedCount}`}
                  />
                </div>
              ) : (
                <div className="h-2 rounded-full bg-surface-container-low border border-outline-variant/40" />
              )}

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-status-success" />
                    <span className="text-on-surface-variant">Compliant devices</span>
                  </div>
                  <span className="font-mono font-bold text-on-surface">{compliantCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-warning" />
                    <span className="text-on-surface-variant">Warning devices</span>
                  </div>
                  <span className="font-mono font-bold text-on-surface">{warningCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-error" />
                    <span className="text-on-surface-variant">Failing devices</span>
                  </div>
                  <span className="font-mono font-bold text-on-surface">{failedCount}</span>
                </div>
              </div>
            </Panel>
          </div>

          {/* Policy Baseline Info */}
          <div className="space-y-4">
            <SectionHeader title="Policy Baseline Coverage" />
            <Panel className="p-5 space-y-3 text-xs">
              <div>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-mono">Assigned Baseline</p>
                <p className="font-bold text-on-surface mt-1">{activePolicyName}</p>
              </div>
              <div>
                <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider font-mono">Active Target Version</p>
                <p className="font-mono font-bold text-tertiary mt-0.5">{activePolicyVer}</p>
              </div>
              <p className="text-[10px] text-on-surface-variant leading-relaxed pt-2 border-t border-outline-variant/40">
                Workstations synchronize baselines locally. Evaluation provenance (such as <code>POLICY_UNAVAILABLE</code> or pending update states) are resolved on active agent handshake telemetry.
              </p>
            </Panel>
          </div>
        </div>

      </div>
    </div>
  )
}
