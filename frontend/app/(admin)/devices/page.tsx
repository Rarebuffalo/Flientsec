"use client"

import React, { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Laptop, Search, ShieldCheck, ShieldAlert, 
  RotateCw, FilterX, ChevronRight, HelpCircle 
} from "lucide-react"
import { 
  PageHeader, SectionHeader, LoadingState, EmptyState, Panel, StatusBadge 
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
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [postureFilter, setPostureFilter] = useState("ALL")
  const [osFilter, setOsFilter] = useState("ALL")
  
  // Sort State
  const [sortField, setSortField] = useState<"hostname" | "compliance_score" | "last_checkin" | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

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

  // Summary strip statistics
  const totalCount = devices.length
  const onlineCount = devices.filter(d => d.status === "ONLINE").length
  
  // Needs Attention: defined as failing baseline OR offline state
  const needsAttentionCount = devices.filter(
    d => d.compliance_status !== "PASS" || d.status !== "ONLINE"
  ).length

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

    // 2. Status filter
    if (statusFilter !== "ALL") {
      result = result.filter(d => d.status === statusFilter)
    }

    // 3. Posture filter
    if (postureFilter !== "ALL") {
      result = result.filter(d => d.compliance_status === postureFilter)
    }

    // 4. OS filter
    if (osFilter !== "ALL") {
      result = result.filter(d => d.os_name === osFilter)
    }

    // 5. Sorting logic
    if (sortField) {
      result.sort((a, b) => {
        let valA: any = a[sortField]
        let valB: any = b[sortField]

        // Handle null timestamps for last_checkin
        if (sortField === "last_checkin") {
          valA = valA ? new Date(valA).getTime() : 0
          valB = valB ? new Date(valB).getTime() : 0
        }

        if (valA < valB) return sortDirection === "asc" ? -1 : 1
        if (valA > valB) return sortDirection === "asc" ? 1 : -1
        return 0
      })
    } else {
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
        return timeB - timeA // Descending time (most recent first)
      })
    }

    return result
  }, [devices, searchQuery, statusFilter, postureFilter, osFilter, sortField, sortDirection])

  const hasActiveFilters = searchQuery !== "" || statusFilter !== "ALL" || postureFilter !== "ALL" || osFilter !== "ALL"

  const handleResetFilters = () => {
    setSearchQuery("")
    setStatusFilter("ALL")
    setPostureFilter("ALL")
    setOsFilter("ALL")
    setSortField(null)
  }

  const toggleSort = (field: "hostname" | "compliance_score" | "last_checkin") => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc") // Default to descending
    }
  }

  if (loading) {
    return <LoadingState message="Retrieving workstation fleet inventory..." />
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans">
      
      {/* Page Header */}
      <PageHeader 
        title="Workstations" 
        subtitle="Monitor enrolled developer workstations and their current security posture."
        actions={
          <button 
            onClick={fetchDevices}
            className="p-2 border border-outline-variant/60 text-on-surface-variant hover:text-on-surface rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors"
            title="Refresh fleet list"
          >
            <RotateCw className="h-4.5 w-4.5" />
          </button>
        }
      />

      {/* API Error Warning */}
      {error && (
        <div className="p-4 rounded-xl border border-error/30 bg-error/5 text-error text-sm flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-2.5">
            <ShieldAlert className="h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button 
            onClick={fetchDevices} 
            className="text-xs font-semibold text-tertiary hover:underline"
          >
            Retry Connection
          </button>
        </div>
      )}

      {devices.length === 0 && !loading && !error ? (
        /* Empty State: No Enrolled Workstations */
        <div className="max-w-xl mx-auto py-8">
          <EmptyState 
            title="No enrolled workstations"
            description="Get started by enrolling workstations using an organization security key in the settings tab."
            icon={Laptop}
          />
          <div className="mt-6 text-center">
            <Link 
              href="/settings" 
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-tertiary hover:bg-white text-surface text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              <span>Go to Enrollment Settings</span>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Strip (Lightweight textual statistics ribbon) */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 py-1 px-1 border-b border-outline-variant/35 text-sm font-medium text-on-surface-variant">
            <span className="flex items-center space-x-2">
              <span>All Workstations</span>
              <span className="px-2 py-0.5 bg-surface-container-high text-on-surface text-xs font-bold rounded-md border border-outline-variant/60">
                {totalCount}
              </span>
            </span>
            <span className="text-outline-variant/60">•</span>
            <span className="flex items-center space-x-2">
              <span>Online</span>
              <span className="px-2 py-0.5 bg-status-success/10 text-status-success text-xs font-bold rounded-md border border-status-success/20">
                {onlineCount}
              </span>
            </span>
            <span className="text-outline-variant/60">•</span>
            <span className="flex items-center space-x-2">
              <span>Needs Attention</span>
              <span className={`px-2 py-0.5 text-xs font-bold rounded-md border ${
                needsAttentionCount > 0 
                  ? "bg-error/15 text-error border-error/25" 
                  : "bg-surface-container-high text-on-surface-variant border-outline-variant/60"
              }`}>
                {needsAttentionCount}
              </span>
            </span>
          </div>

          {/* Search and Filters Toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative max-w-md w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-on-surface-variant/65" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workstations (name, UUID, OS)..."
                className="w-full pl-10 pr-4 py-2 bg-surface-container border border-outline-variant focus:border-tertiary focus:ring-1 focus:ring-tertiary rounded-lg text-sm placeholder-on-surface-variant/50 focus:outline-none transition-colors"
              />
            </div>

            {/* Filter selectors */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Connection Status filter */}
              <div className="flex flex-col">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-surface-container border border-outline-variant hover:border-outline-variant/80 rounded-lg text-xs font-semibold px-3 py-2 focus:outline-none focus:ring-1 focus:ring-tertiary transition-colors cursor-pointer text-on-surface"
                >
                  <option value="ALL">Status: All</option>
                  <option value="ONLINE">Status: Online</option>
                  <option value="OFFLINE">Status: Offline</option>
                </select>
              </div>

              {/* Posture filter */}
              <div className="flex flex-col">
                <select
                  value={postureFilter}
                  onChange={(e) => setPostureFilter(e.target.value)}
                  className="bg-surface-container border border-outline-variant hover:border-outline-variant/80 rounded-lg text-xs font-semibold px-3 py-2 focus:outline-none focus:ring-1 focus:ring-tertiary transition-colors cursor-pointer text-on-surface"
                >
                  <option value="ALL">Posture: All</option>
                  <option value="PASS">Posture: Compliant</option>
                  <option value="WARN">Posture: Warning</option>
                  <option value="FAIL">Posture: Failing</option>
                </select>
              </div>

              {/* OS filter */}
              {uniqueOSNames.length > 0 && (
                <div className="flex flex-col">
                  <select
                    value={osFilter}
                    onChange={(e) => setOsFilter(e.target.value)}
                    className="bg-surface-container border border-outline-variant hover:border-outline-variant/80 rounded-lg text-xs font-semibold px-3 py-2 focus:outline-none focus:ring-1 focus:ring-tertiary transition-colors cursor-pointer text-on-surface"
                  >
                    <option value="ALL">OS: All</option>
                    {uniqueOSNames.map(os => (
                      <option key={os} value={os}>OS: {os}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reset active filters button */}
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface border border-outline-variant bg-surface-container-low hover:bg-surface-container rounded-lg transition-colors"
                >
                  <FilterX className="h-3.5 w-3.5" />
                  <span>Clear Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Fleet Inventory Table */}
          {processedDevices.length === 0 ? (
            /* Empty State: Search Results Return 0 matches */
            <div className="py-6">
              <EmptyState 
                title="No matching workstations"
                description="No enrolled devices match the current query terms or selected filters."
                icon={FilterX}
              />
              <div className="mt-4 text-center">
                <button
                  onClick={handleResetFilters}
                  className="px-3.5 py-1.5 border border-outline-variant bg-surface-container-high hover:bg-surface-container-highest text-xs font-semibold rounded-lg transition-colors"
                >
                  Reset Active Filters
                </button>
              </div>
            </div>
          ) : (
            <div className="border border-outline-variant rounded-xl bg-surface-container overflow-hidden">
              <table className="w-full text-left border-collapse text-[14px]">
                <thead>
                  <tr className="border-b border-outline-variant bg-surface-container-low/40 font-semibold text-on-surface-variant uppercase tracking-wider text-xs font-sans select-none">
                    <th 
                      onClick={() => toggleSort("hostname")}
                      className="px-5 py-3.5 cursor-pointer hover:bg-surface-container-high/30 transition-colors"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>Workstation</span>
                        {sortField === "hostname" && (sortDirection === "asc" ? " ▴" : " ▾")}
                      </div>
                    </th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Posture</th>
                    <th 
                      onClick={() => toggleSort("compliance_score")}
                      className="px-5 py-3.5 cursor-pointer hover:bg-surface-container-high/30 transition-colors"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>Score</span>
                        {sortField === "compliance_score" && (sortDirection === "asc" ? " ▴" : " ▾")}
                      </div>
                    </th>
                    <th className="px-5 py-3.5 hidden md:table-cell">Operating System</th>
                    <th 
                      onClick={() => toggleSort("last_checkin")}
                      className="px-5 py-3.5 hidden sm:table-cell cursor-pointer hover:bg-surface-container-high/30 transition-colors"
                    >
                      <div className="flex items-center space-x-1.5">
                        <span>Last Seen</span>
                        {sortField === "last_checkin" && (sortDirection === "asc" ? " ▴" : " ▾")}
                      </div>
                    </th>
                    <th className="px-5 py-3.5 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40 text-on-surface font-sans">
                  {processedDevices.map((device) => {
                    const relativeTime = getRelativeTime(device.last_checkin)
                    const fullTime = device.last_checkin 
                      ? new Date(device.last_checkin).toLocaleString() 
                      : "Never"

                    return (
                      <tr 
                        key={device.id} 
                        onClick={() => router.push(`/devices/${device.id}`)}
                        className="hover:bg-surface-container-high/15 transition-colors cursor-pointer group"
                      >
                        {/* Hostname & shortened UUID */}
                        <td className="px-5 py-4 min-w-[180px]">
                          <div className="space-y-1">
                            <span className="font-semibold text-on-surface group-hover:text-tertiary transition-colors">
                              {device.hostname}
                            </span>
                            <p className="text-[12px] font-mono text-on-surface-variant/80 select-all" onClick={(e) => e.stopPropagation()}>
                              {device.id.slice(0, 8)}...
                            </p>
                          </div>
                        </td>

                        {/* Connection Status */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center space-x-1.5">
                            <span className={`h-2 w-2 rounded-full ${
                              device.status === "ONLINE" ? "bg-status-success" : "bg-on-surface-variant/40"
                            }`}></span>
                            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider font-sans">
                              {device.status === "ONLINE" ? "Online" : "Offline"}
                            </span>
                          </span>
                        </td>

                        {/* Posture Badges */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <StatusBadge status={device.compliance_status} />
                        </td>

                        {/* Mostly neutral Posture Score */}
                        <td className="px-5 py-4 whitespace-nowrap font-mono text-[13px] text-on-surface font-semibold">
                          {device.compliance_score}/100
                        </td>

                        {/* OS (Hidden on mobile) */}
                        <td className="px-5 py-4 hidden md:table-cell whitespace-nowrap text-on-surface-variant">
                          <span className="font-medium text-on-surface">{device.os_name}</span>
                          <span className="text-xs text-on-surface-variant/80 ml-1.5">v{device.os_version}</span>
                        </td>

                        {/* Relative last seen time with full ISO tooltip (Hidden on very small screens) */}
                        <td className="px-5 py-4 hidden sm:table-cell whitespace-nowrap text-on-surface-variant text-xs">
                          <span title={`UTC Timestamp: ${fullTime}`} className="cursor-help hover:text-on-surface transition-colors border-b border-dashed border-outline-variant/40">
                            {relativeTime}
                          </span>
                        </td>

                        {/* Row Navigation arrow */}
                        <td className="px-5 py-4 text-right whitespace-nowrap">
                          <ChevronRight className="h-4.5 w-4.5 inline text-on-surface-variant group-hover:text-tertiary transition-colors transform group-hover:translate-x-0.5" />
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
