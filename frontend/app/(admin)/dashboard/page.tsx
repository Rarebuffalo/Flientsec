"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { Shield, ShieldAlert, ShieldCheck, Laptop, RefreshCw, Download } from "lucide-react"

interface Device {
  id: string
  hostname: string
  os_name: string
  os_version: string
  os_arch: string
  status: string // ONLINE / OFFLINE / UNKNOWN
  compliance_status: string // PASS / FAIL / WARN
  compliance_score: number
  last_checkin: string | null
}

export default function Dashboard() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  useEffect(() => {
    setLoading(true)
    const loadData = async () => {
      try {
        const loginRes = await fetch(`${apiUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            username: "admin@flientsec.local",
            password: "flientsec_admin_pass"
          })
        })

        if (!loginRes.ok) {
          throw new Error("Authentication failed")
        }
        const tokenData = await loginRes.json()

        const devicesRes = await fetch(`${apiUrl}/api/v1/devices`, {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`
          }
        })
        if (!devicesRes.ok) {
          throw new Error("Failed to load device listing")
        }
        const devicesList = await devicesRes.json()
        setDevices(devicesList)
        setError(null)
      } catch (err: any) {
        setError(err.message || "An error occurred while connecting to the backend.")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [refreshKey, apiUrl])

  const exportReport = async () => {
    try {
      const loginRes = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          username: "admin@flientsec.local",
          password: "flientsec_admin_pass"
        })
      })
      if (!loginRes.ok) return
      const tokenData = await loginRes.json()

      window.open(`${apiUrl}/api/v1/reports/export?token=${tokenData.access_token}`, "_blank")
    } catch (e) {
      console.error(e)
    }
  }

  // Aggregate stats
  const totalCount = devices.length
  const compliantCount = devices.filter((d) => d.compliance_status === "PASS").length
  const warningCount = devices.filter((d) => d.compliance_status === "WARN").length
  const failedCount = devices.filter((d) => d.compliance_status === "FAIL").length

  return (
    <div className="space-y-8 flex-1 flex flex-col">
      {/* Upper header action bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Workstation Posture</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            Real-time compliance validation of engineering laptops in your fleet.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setRefreshKey((prev) => prev + 1)}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Refresh</span>
          </button>
          <button
            onClick={exportReport}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-200 text-xs font-semibold rounded bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded border border-danger/30 bg-danger/5 text-sm text-danger flex items-center space-x-2">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span>{error} (Ensure the backend service is running at {apiUrl})</span>
        </div>
      )}

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-premium">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Laptops</p>
            <p className="text-3xl font-bold mt-2 text-slate-900">{loading ? "..." : totalCount}</p>
          </div>
          <Laptop className="h-8 w-8 text-slate-400" />
        </div>
        <div className="p-5 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-premium">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Compliant</p>
            <p className="text-3xl font-bold mt-2 text-success">{loading ? "..." : compliantCount}</p>
          </div>
          <ShieldCheck className="h-8 w-8 text-success" />
        </div>
        <div className="p-5 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-premium">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Warnings</p>
            <p className="text-3xl font-bold mt-2 text-warning">{loading ? "..." : warningCount}</p>
          </div>
          <Shield className="h-8 w-8 text-warning" />
        </div>
        <div className="p-5 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-premium">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Failed Policies</p>
            <p className="text-3xl font-bold mt-2 text-danger">{loading ? "..." : failedCount}</p>
          </div>
          <ShieldAlert className="h-8 w-8 text-danger" />
        </div>
      </div>

      {/* Fleet table */}
      <div className="bg-white border border-slate-200 rounded-lg flex-1 flex flex-col overflow-hidden shadow-premium">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <h2 className="font-bold text-sm uppercase tracking-wider text-slate-700">Active Device Registers</h2>
          <span className="text-xs text-slate-400">Total items: {devices.length}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex-1 flex items-center justify-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Retrieving fleet registers...</span>
          </div>
        ) : devices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex-1 flex items-center justify-center">
            No devices are currently connected. Run the client installer script on a developer workstation to check in.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold text-slate-500">
                  <th className="px-6 py-3">Hostname</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Compliance State</th>
                  <th className="px-6 py-3 text-center">Score</th>
                  <th className="px-6 py-3">OS</th>
                  <th className="px-6 py-3">Architecture</th>
                  <th className="px-6 py-3">Last Active</th>
                  <th className="px-6 py-3 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-600">
                {devices.map((device) => {
                  const checkinTime = device.last_checkin
                    ? new Date(device.last_checkin).toLocaleTimeString()
                    : "never"
                  
                  return (
                    <tr key={device.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-semibold text-slate-900">{device.hostname}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                            device.status === "ONLINE"
                              ? "bg-success/10 text-success border border-success/20"
                              : "bg-slate-100 text-slate-400 border border-slate-200"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              device.status === "ONLINE" ? "bg-success" : "bg-slate-400"
                            }`}
                          ></span>
                          <span>{device.status}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${
                            device.compliance_status === "PASS"
                              ? "bg-success/15 text-success border border-success/30"
                              : device.compliance_status === "WARN"
                              ? "bg-warning/15 text-warning border border-warning/30"
                              : "bg-danger/15 text-danger border border-danger/30"
                          }`}
                        >
                          {device.compliance_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center font-bold font-mono">
                        <span
                          className={
                            device.compliance_score >= 90
                              ? "text-success"
                              : device.compliance_score >= 70
                              ? "text-warning"
                              : "text-danger"
                          }
                        >
                          {device.compliance_score}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {device.os_name} {device.os_version}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">{device.os_arch}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{checkinTime}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/devices/${device.id}`}
                          className="text-xs font-bold text-primary hover:text-emerald-800 hover:underline"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
