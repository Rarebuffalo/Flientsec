"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeft, ShieldCheck, ShieldAlert, Laptop, Terminal, Calendar, Activity, CheckCircle2, XCircle } from "lucide-react"

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
  rule_name: string
  status: string
  message: string
  severity: string
}

interface CheckRun {
  id: string
  timestamp: string
  status: string
  score: number
  findings: Finding[]
}

interface HistoryEvent {
  id: string
  type: string // VIOLATION_TRIGGERED / VIOLATION_RESOLVED
  rule_name: string
  message: string
  timestamp: string
}

export default function DeviceDetails() {
  const params = useParams()
  const deviceId = params.id as string

  const [device, setDevice] = useState<Device | null>(null)
  const [latestRun, setLatestRun] = useState<CheckRun | null>(null)
  const [history, setHistory] = useState<HistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true)
        // Login to get token
        const loginRes = await fetch(`${apiUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            username: "admin@flientsec.local",
            password: "flientsec_admin_pass"
          })
        })
        if (!loginRes.ok) throw new Error("Auth failed")
        const tokenData = await loginRes.json()
        const headers = { Authorization: `Bearer ${tokenData.access_token}` }

        // Fetch Device specs
        const devRes = await fetch(`${apiUrl}/api/v1/devices/${deviceId}`, { headers })
        if (!devRes.ok) throw new Error("Device not found")
        const devData = await devRes.json()
        setDevice(devData)

        // Fetch Latest CheckRun
        const runRes = await fetch(`${apiUrl}/api/v1/devices/${deviceId}/latest-run`, { headers })
        if (runRes.ok) {
          const runData = await runRes.json()
          setLatestRun(runData)
        }

        // Fetch History
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert("Copied to clipboard: " + text)
  }

  // Get remediation code snippet
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

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Retrieving device information...</div>
  }

  if (error || !device) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded border border-danger/30 bg-danger/5 text-danger text-sm">
          {error || "Workstation profile not found."}
        </div>
        <Link href="/dashboard" className="inline-flex items-center space-x-1 text-sm font-bold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to fleet overview</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col">
      {/* Navigation and Name bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <Link href="/dashboard" className="inline-flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-900 transition-colors">
            <ArrowLeft className="h-3 w-3" />
            <span>Fleet Overview</span>
          </Link>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-extrabold tracking-tight font-mono text-slate-900">{device.hostname}</h1>
            <span
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                device.status === "ONLINE"
                  ? "bg-success/10 text-success border border-success/20"
                  : "bg-slate-100 text-slate-400 border border-slate-200"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${device.status === "ONLINE" ? "bg-success" : "bg-slate-400"}`}></span>
              <span>{device.status}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-xs text-slate-455 text-slate-400 font-medium">Compliance Score</p>
            <p className="text-2xl font-bold font-mono tracking-tight mt-0.5">
              <span className={device.compliance_score >= 90 ? "text-success" : device.compliance_score >= 70 ? "text-warning" : "text-danger"}>
                {device.compliance_score}/100
              </span>
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded text-xs font-bold ${
              device.compliance_status === "PASS"
                ? "bg-success/15 text-success border border-success/30"
                : device.compliance_status === "WARN"
                ? "bg-warning/15 text-warning border border-warning/30"
                : "bg-danger/15 text-danger border border-danger/30"
            }`}
          >
            {device.compliance_status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Device metadata specs */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-premium">
          <h2 className="text-sm font-bold uppercase tracking-wider border-b border-slate-200 pb-3 flex items-center space-x-2 text-slate-700">
            <Laptop className="h-4 w-4" />
            <span>Specifications</span>
          </h2>
          <div className="space-y-4 text-sm font-mono text-slate-600">
            <div>
              <p className="text-xs text-slate-400 font-medium">Device UUID</p>
              <p className="text-xs font-medium truncate mt-1 text-slate-900">{device.id}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 font-medium">OS Name</p>
                <p className="font-medium mt-1 text-slate-900">{device.os_name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">OS Version</p>
                <p className="font-medium mt-1 text-slate-900">{device.os_version}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 font-medium">Architecture</p>
                <p className="font-medium mt-1 text-slate-900">{device.os_arch}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Agent Version</p>
                <p className="font-medium mt-1 text-slate-900">{device.agent_version}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Kernel Version</p>
              <p className="text-xs font-medium mt-1 truncate text-slate-900">{device.kernel_version}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Last Handshake</p>
              <p className="text-xs font-medium mt-1 text-slate-500">
                {device.last_checkin ? new Date(device.last_checkin).toLocaleString() : "never"}
              </p>
            </div>
          </div>
        </div>

        {/* Violations and remediations column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active findings card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-premium">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center space-x-2 text-slate-700">
                <Activity className="h-4 w-4" />
                <span>Security Findings</span>
              </h2>
              <span className="text-xs text-slate-400">
                Active violations: {latestRun?.findings.length || 0}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {!latestRun || latestRun.findings.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm flex flex-col items-center justify-center space-y-2">
                  <ShieldCheck className="h-8 w-8 text-success" />
                  <p className="font-semibold text-slate-800">No violations detected</p>
                  <p className="text-xs">This workstation complies with all organizational security policy criteria.</p>
                </div>
              ) : (
                latestRun.findings.map((finding) => (
                  <div key={finding.id} className="p-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold capitalize text-base text-slate-900">{finding.rule_name}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            finding.severity === "HIGH" ? "bg-danger/10 text-danger border border-danger/20" :
                            finding.severity === "MEDIUM" ? "bg-warning/10 text-warning border border-warning/20" :
                            "bg-slate-100 text-slate-400 border border-slate-200"
                          }`}>
                            {finding.severity}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">{finding.message}</p>
                      </div>
                      <span className={`flex-shrink-0 inline-flex items-center space-x-1 px-2.5 py-0.5 rounded text-xs font-semibold ${
                        finding.status === "FAIL" ? "bg-danger/15 text-danger" : "bg-warning/15 text-warning"
                      }`}>
                        {finding.status}
                      </span>
                    </div>

                    {/* Remediation code block */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between bg-slate-100/50">
                        <span className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5 font-mono">
                          <Terminal className="h-3.5 w-3.5 text-slate-500" />
                          <span>Remediation Copy-Paste Fix</span>
                        </span>
                        <button
                          onClick={() => copyToClipboard(getRemediation(finding.rule_name, device.os_name))}
                          className="text-[10px] font-bold text-primary hover:text-emerald-800 hover:underline"
                        >
                          Copy Command
                        </button>
                      </div>
                      <pre className="p-4 overflow-x-auto text-xs text-slate-800 font-mono bg-slate-50">
                        <code>{getRemediation(finding.rule_name, device.os_name)}</code>
                      </pre>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* History Event log */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-premium">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <h2 className="text-sm font-bold uppercase tracking-wider flex items-center space-x-2 text-slate-700">
                <Calendar className="h-4 w-4" />
                <span>Historical Audit Trails</span>
              </h2>
            </div>
            <div className="p-6">
              {history.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No security state transition events recorded for this device.</p>
              ) : (
                <div className="space-y-4">
                  {history.map((event) => (
                    <div key={event.id} className="flex items-start space-x-3 text-sm">
                      <div className="mt-0.5">
                        {event.type === "VIOLATION_TRIGGERED" ? (
                          <XCircle className="h-4 w-4 text-danger flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="font-semibold text-xs leading-none text-slate-800">{event.message}</p>
                        <p className="text-[10px] text-slate-400 font-mono leading-none mt-1">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
