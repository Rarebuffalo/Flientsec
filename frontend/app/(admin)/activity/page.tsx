"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCw, FilterX } from "lucide-react"
import {
  PageHeader, LoadingState, EmptyState
} from "../../../components/ui"

type EventType = "VIOLATION_TRIGGERED" | "VIOLATION_RESOLVED" | "POLICY_ROLLBACK"

interface FleetEvent {
  id: string
  type: EventType
  timestamp: string
  message: string
  rule_name: string
  device_id: string | null
  device_hostname: string | null
  finding_id: string | null
  policy_version_id: string | null
  policy_name: string | null
  policy_version_number: number | null
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

export default function ActivityPage() {
  const router = useRouter()
  const [events, setEvents] = useState<FleetEvent[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Authoritative pagination
  const [total, setTotal] = useState(0)
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)

  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState<"ALL" | EventType>("ALL")
  const [deviceFilter, setDeviceFilter] = useState<string>("ALL")

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

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
    } catch {
      setDevices([])
    }
  }

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("flientsec_token")
      if (!token) {
        router.push("/login")
        return
      }

      const params = new URLSearchParams()
      params.append("limit", limit.toString())
      params.append("offset", offset.toString())
      if (eventTypeFilter !== "ALL") {
        params.append("type", eventTypeFilter)
      }
      if (deviceFilter !== "ALL") {
        params.append("device_id", deviceFilter)
      }

      const res = await fetch(`${apiUrl}/api/v1/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("flientsec_token")
          router.push("/login")
          return
        }
        throw new Error("Unable to load security activity.")
      }

      const data = await res.json()
      setEvents(data.items || [])
      setTotal(data.total || 0)
      setError(null)
    } catch (err: any) {
      setError(err.message || "Unable to load security activity.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [eventTypeFilter, deviceFilter, offset])

  useEffect(() => {
    setOffset(0)
  }, [eventTypeFilter, deviceFilter])

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.floor(offset / limit) + 1
  const hasActiveFilters = eventTypeFilter !== "ALL" || deviceFilter !== "ALL"

  const handleClearFilters = () => {
    setEventTypeFilter("ALL")
    setDeviceFilter("ALL")
    setOffset(0)
  }

  const handlePreviousPage = () => {
    if (offset > 0) setOffset(Math.max(0, offset - limit))
  }

  const handleNextPage = () => {
    if (offset + limit < total) setOffset(offset + limit)
  }

  return (
    <div className="space-y-8 flex-1 flex flex-col font-sans">
      {/* Page Header */}
      <PageHeader
        title="Activity"
        subtitle="Fleet security audit and control plane timeline."
        actions={
          <button
            onClick={fetchEvents}
            className="btn btn-sm"
            aria-label="Refresh activity"
            title="Refresh activity"
          >
            <RotateCw className="h-4.5 w-4.5" />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Filters Row */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value as any)}
          className="select"
        >
          <option value="ALL">All event types</option>
          <option value="VIOLATION_TRIGGERED">Violation triggered</option>
          <option value="VIOLATION_RESOLVED">Violation resolved</option>
          <option value="POLICY_ROLLBACK">Policy rollback</option>
        </select>

        <select
          value={deviceFilter}
          onChange={(e) => setDeviceFilter(e.target.value)}
          className="select"
        >
          <option value="ALL">All workstations</option>
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

      {/* Main List */}
      {loading ? (
        <LoadingState message="Fetching activity logs..." />
      ) : error ? (
        <div className="panel p-5 border border-danger/30 bg-danger/5 text-danger flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchEvents} className="btn btn-sm">Retry</button>
        </div>
      ) : events.length === 0 ? (
        <div className="py-6">
          <EmptyState
            title="No activity events recorded"
            description={hasActiveFilters ? "Try adjusting filters." : "Workstation security event history is empty."}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="event-list">
            {events.map((e) => {
              const isRollback = e.type === "POLICY_ROLLBACK"
              const isTrigger = e.type === "VIOLATION_TRIGGERED"
              return (
                <div key={e.id} className="event-item">
                  <div className="event-row">
                    <div className="event-dot-outer">
                      <div
                        className={`event-dot ${isTrigger ? "trigger" : isRollback ? "bg-amber-400" : "resolve"}`}
                        style={isRollback ? { backgroundColor: "#F59E0B" } : undefined}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="event-title">
                        {isRollback
                          ? "Policy standard rolled back"
                          : isTrigger
                          ? "Violation triggered"
                          : "Violation resolved"}
                      </div>
                      <div className="event-msg">
                        {e.device_hostname ? `${e.device_hostname} · ` : ""}{e.message}
                      </div>
                      <div className="event-meta">
                        <span className="mono">{e.rule_name}</span>
                        <span>{e.policy_name || "Baseline Policy"} · v{e.policy_version_number || 1}</span>
                        <span>{getRelativeTime(e.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border border-border/80 rounded-xl bg-surface-1 p-4 text-sm">
              <span className="text-xs text-text-secondary font-medium">
                Showing <span className="font-semibold text-text-primary">{offset + 1}</span> to{" "}
                <span className="font-semibold text-text-primary">
                  {Math.min(total, offset + limit)}
                </span>{" "}
                of <span className="font-semibold text-text-primary">{total}</span> events (Page {currentPage} of {totalPages})
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
    </div>
  )
}
