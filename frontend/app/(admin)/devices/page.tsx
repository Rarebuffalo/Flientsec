"use client"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Search, ShieldAlert, RotateCw, FilterX
} from "lucide-react"
import {
  PageHeader, LoadingState, EmptyState, StatusBadge, ConnectionBadge
} from "../../../components/ui"

interface Device {
  id: string
  organization_id: string
  hostname: string
  os_name: string
  os_version: string
  os_arch: string
  status: string
  compliance_status: string
  compliance_score: number
  last_checkin: string | null
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

export default function WorkstationsPage() {
  const router = useRouter()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtering & Search state
  const [searchQuery, setSearchQuery] = useState("")
  const [connFilter, setConnFilter] = useState("all")
  const [postureFilter, setPostureFilter] = useState("all")
  const [osFilter, setOsFilter] = useState("all")

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const fetchDevices = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("flientsec_token")
      if (!token) {
        router.push("/login")
        return
      }
      const headers = { Authorization: `Bearer ${token}` }

      const res = await fetch(`${apiUrl}/api/v1/devices`, { headers })
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("flientsec_token")
          router.push("/login")
          return
        }
        throw new Error("Failed to retrieve workstation fleet data")
      }
      const data = await res.json()
      setDevices(data)
      setError(null)
    } catch (err: any) {
      setError(err.message || "Could not establish database connection.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  // Calculate unique operating systems for OS filter dropdown
  const uniqueOSNames = useMemo(() => {
    const names = devices.map(d => d.os_name).filter(Boolean)
    return Array.from(new Set(names))
  }, [devices])

  // Filtered & Sorted Workstations
  const processedDevices = useMemo(() => {
    let result = [...devices]

    // 1. Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(d =>
        d.hostname.toLowerCase().includes(query) ||
        d.id.toLowerCase().includes(query) ||
        (d.os_name && d.os_name.toLowerCase().includes(query))
      )
    }

    // 2. Connection status filter
    if (connFilter !== "all") {
      const target = connFilter.toUpperCase()
      result = result.filter(d => d.status.toUpperCase() === target)
    }

    // 3. Posture filter
    if (postureFilter !== "all") {
      const target = postureFilter.toUpperCase()
      // Mapping PASS/WARN/FAIL
      let statusMap = "PASS"
      if (target === "WARNING") statusMap = "WARN"
      if (target === "FAILING") statusMap = "FAIL"
      result = result.filter(d => d.compliance_status.toUpperCase() === statusMap)
    }

    // 4. OS filter
    if (osFilter !== "all") {
      result = result.filter(d => d.os_name === osFilter)
    }

    // Default Sort Order: FAIL -> WARN -> PASS, then most recent last_checkin first
    result.sort((a, b) => {
      const postureWeight = (status: string) => {
        if (status === "FAIL") return 1
        if (status === "WARN") return 2
        if (status === "PASS") return 3
        return 4
      }

      const weightA = postureWeight(a.compliance_status)
      const weightB = postureWeight(b.compliance_status)

      if (weightA !== weightB) {
        return weightA - weightB
      }

      const timeA = a.last_checkin ? new Date(a.last_checkin).getTime() : 0
      const timeB = b.last_checkin ? new Date(b.last_checkin).getTime() : 0
      return timeB - timeA
    })

    return result
  }, [devices, searchQuery, connFilter, postureFilter, osFilter])

  const hasActiveFilters = searchQuery !== "" || connFilter !== "all" || postureFilter !== "all" || osFilter !== "all"

  const handleResetFilters = () => {
    setSearchQuery("")
    setConnFilter("all")
    setPostureFilter("all")
    setOsFilter("all")
  }

  if (loading) {
    return <LoadingState message="Retrieving workstation fleet inventory..." />
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans">

      {/* Page Header */}
      <PageHeader
        title="Devices"
        subtitle={`Fleet inventory · ${devices.length} workstations enrolled.`}
        actions={
          <button
            onClick={fetchDevices}
            className="btn btn-sm"
            aria-label="Refresh fleet list"
            title="Refresh fleet list"
          >
            <RotateCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        }
      />

      {/* API Error Warning */}
      {error && (
        <div className="panel p-5 border border-danger/30 bg-danger/5 text-danger text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDevices}
            className="btn btn-sm"
          >
            Retry Connection
          </button>
        </div>
      )}

      {devices.length === 0 && !loading && !error ? (
        <div className="max-w-xl mx-auto py-8">
          <EmptyState
            title="No enrolled workstations"
            description="Get started by enrolling workstations using an organization security key in the settings tab."
            icon={Laptop}
          />
        </div>
      ) : (
        <>
          {/* Search and Filters Toolbar */}
          <div className="section" style={{ marginBottom: "20px" }}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div className="input-wrap max-w-xs w-full">
                <Search className="h-4.5 w-4.5 text-text-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search hostname, UUID, OS…"
                  className="input"
                />
              </div>
              <select
                value={osFilter}
                onChange={(e) => setOsFilter(e.target.value)}
                className="select"
              >
                <option value="all">All operating systems</option>
                {uniqueOSNames.map(os => (
                  <option key={os} value={os}>{os}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-6 items-center">
              <div>
                <div className="section-hint" style={{ marginBottom: "7px" }}>Connection</div>
                <div className="chip-row">
                  <button
                    onClick={() => setConnFilter("all")}
                    className={`chip ${connFilter === "all" ? "active" : ""}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setConnFilter("online")}
                    className={`chip ${connFilter === "online" ? "active" : ""}`}
                  >
                    Online
                  </button>
                  <button
                    onClick={() => setConnFilter("offline")}
                    className={`chip ${connFilter === "offline" ? "active" : ""}`}
                  >
                    Offline
                  </button>
                </div>
              </div>

              <div>
                <div className="section-hint" style={{ marginBottom: "7px" }}>Posture</div>
                <div className="chip-row">
                  <button
                    onClick={() => setPostureFilter("all")}
                    className={`chip ${postureFilter === "all" ? "active" : ""}`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setPostureFilter("compliant")}
                    className={`chip ${postureFilter === "compliant" ? "active" : ""}`}
                  >
                    Compliant
                  </button>
                  <button
                    onClick={() => setPostureFilter("warning")}
                    className={`chip ${postureFilter === "warning" ? "active" : ""}`}
                  >
                    Warning
                  </button>
                  <button
                    onClick={() => setPostureFilter("failing")}
                    className={`chip ${postureFilter === "failing" ? "active" : ""}`}
                  >
                    Failing
                  </button>
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="btn btn-sm text-text-muted mt-6"
                >
                  <FilterX className="h-3.5 w-3.5 inline mr-1" />
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Fleet Inventory Table */}
          {processedDevices.length === 0 ? (
            <div className="py-6">
              <EmptyState
                title="No matching workstations"
                description="No enrolled devices match the current query terms or selected filters."
                icon={FilterX}
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Hostname</th>
                    <th>Status</th>
                    <th>Posture</th>
                    <th>Score</th>
                    <th>OS</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {processedDevices.map((device) => {
                    const relativeTime = getRelativeTime(device.last_checkin)
                    return (
                      <tr
                        key={device.id}
                        onClick={() => router.push(`/devices/${device.id}`)}
                        className="clickable"
                      >
                        <td data-label="Hostname">
                          <div className="cell-primary">{device.hostname}</div>
                          <div className="cell-sub mono">{device.id}</div>
                        </td>
                        <td data-label="Status">
                          <ConnectionBadge status={device.status} lastSeen={relativeTime} />
                        </td>
                        <td data-label="Posture">
                          <StatusBadge status={device.compliance_status} />
                        </td>
                        <td data-label="Score" className="mono" style={{ fontWeight: 700 }}>
                          {device.compliance_score}/100
                        </td>
                        <td data-label="OS">
                          {device.os_name} <span className="muted">{device.os_version}</span>
                        </td>
                        <td data-label="Last seen" className="muted">
                          {relativeTime}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const Laptop = (props: any) => (
  <svg {...props} fill="none" strokeWidth="2" stroke="currentColor" viewBox="0 0 24 24">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="2" y1="20" x2="22" y2="20" />
    <line x1="12" y1="17" x2="12" y2="20" />
  </svg>
)
