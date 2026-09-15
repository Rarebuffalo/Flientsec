"use client"

import React, { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Search, ShieldAlert, RotateCw, FilterX, FolderKanban, Laptop
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
  group_id: string | null
  group_name: string | null
  effective_policy_source: string | null
  effective_policy_name: string | null
}

interface DeviceGroup {
  id: string
  name: string
  device_count: number
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
  const [groups, setGroups] = useState<DeviceGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtering & Search state
  const [searchQuery, setSearchQuery] = useState("")
  const [connFilter, setConnFilter] = useState("all")
  const [postureFilter, setPostureFilter] = useState("all")
  const [osFilter, setOsFilter] = useState("all")
  const [groupFilter, setGroupFilter] = useState("all")

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const fetchDevicesAndGroups = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("flientsec_token")
      if (!token) {
        router.push("/login")
        return
      }
      const headers = { Authorization: `Bearer ${token}` }

      const [resDevices, resGroups] = await Promise.all([
        fetch(`${apiUrl}/api/v1/devices`, { headers }),
        fetch(`${apiUrl}/api/v1/device-groups`, { headers }),
      ])

      if (!resDevices.ok) {
        if (resDevices.status === 401) {
          localStorage.removeItem("flientsec_token")
          router.push("/login")
          return
        }
        throw new Error("Failed to retrieve workstation fleet data")
      }
      const dataDevices = await resDevices.json()
      setDevices(dataDevices)

      if (resGroups.ok) {
        const dataGroups = await resGroups.json()
        setGroups(dataGroups)
      }

      setError(null)
    } catch (err: any) {
      setError(err.message || "Could not establish database connection.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevicesAndGroups()
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
        (d.os_name && d.os_name.toLowerCase().includes(query)) ||
        (d.group_name && d.group_name.toLowerCase().includes(query))
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
      let statusMap = "PASS"
      if (target === "WARNING") statusMap = "WARN"
      if (target === "FAILING") statusMap = "FAIL"
      result = result.filter(d => d.compliance_status.toUpperCase() === statusMap)
    }

    // 4. OS filter
    if (osFilter !== "all") {
      result = result.filter(d => d.os_name === osFilter)
    }

    // 5. Group filter
    if (groupFilter !== "all") {
      if (groupFilter === "ungrouped") {
        result = result.filter(d => !d.group_id)
      } else {
        result = result.filter(d => d.group_id === groupFilter)
      }
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
  }, [devices, searchQuery, connFilter, postureFilter, osFilter, groupFilter])

  const hasActiveFilters =
    searchQuery !== "" ||
    connFilter !== "all" ||
    postureFilter !== "all" ||
    osFilter !== "all" ||
    groupFilter !== "all"

  const handleResetFilters = () => {
    setSearchQuery("")
    setConnFilter("all")
    setPostureFilter("all")
    setOsFilter("all")
    setGroupFilter("all")
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
            onClick={fetchDevicesAndGroups}
            className="btn btn-sm"
            aria-label="Refresh fleet list"
            title="Refresh fleet list"
          >
            <RotateCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Sub-Navigation Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-6 text-sm">
          <div className="pb-3 text-brand font-semibold border-b-2 border-brand flex items-center gap-2">
            <Laptop className="h-4 w-4" />
            <span>Enrolled Workstations ({devices.length})</span>
          </div>
          <Link
            href="/devices/groups"
            className="pb-3 text-text-muted hover:text-text-main font-medium border-b-2 border-transparent flex items-center gap-2"
          >
            <FolderKanban className="h-4 w-4" />
            <span>Device Groups ({groups.length})</span>
          </Link>
        </div>
      </div>

      {/* API Error Warning */}
      {error && (
        <div className="panel p-5 border border-danger/30 bg-danger/5 text-danger text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchDevicesAndGroups} className="btn btn-sm">
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
                  placeholder="Search hostname, UUID, OS, group…"
                  className="input"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="select text-xs"
                >
                  <option value="all">All device groups</option>
                  <option value="ungrouped">Ungrouped only</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name} ({g.device_count})</option>
                  ))}
                </select>

                <select
                  value={osFilter}
                  onChange={(e) => setOsFilter(e.target.value)}
                  className="select text-xs"
                >
                  <option value="all">All operating systems</option>
                  {uniqueOSNames.map(os => (
                    <option key={os} value={os}>{os}</option>
                  ))}
                </select>
              </div>
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
                    <th>Group</th>
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
                        <td data-label="Group">
                          {device.group_name ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                              <FolderKanban className="h-3 w-3 text-brand" />
                              <span>{device.group_name}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-text-muted italic">Ungrouped</span>
                          )}
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
