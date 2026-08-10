"use client"

import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FilterX,
  Laptop,
  RotateCw,
  ShieldAlert,
} from "lucide-react"
import {
  EmptyState,
  LoadingState,
  PageHeader,
  Panel,
  SectionHeader,
  StatusBadge,
} from "../../../components/ui"

type EventType = "VIOLATION_TRIGGERED" | "VIOLATION_RESOLVED"
type TimeRange = "ALL" | "24H" | "7D" | "30D"

interface FleetEvent {
  id: string
  type: EventType
  timestamp: string
  message: string
  rule_name: string
  device_id: string
  device_hostname: string
  finding_id: string | null
  policy_version_id: string | null
  policy_name: string | null
  policy_version_number: number | null
}

interface Device {
  id: string
  hostname: string
}

interface EventGroup {
  label: string
  events: FleetEvent[]
}

const eventLabels: Record<EventType, string> = {
  VIOLATION_TRIGGERED: "Violation triggered",
  VIOLATION_RESOLVED: "Violation resolved",
}

function getRelativeTime(dateString: string): string {
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

function getDateGroupLabel(dateString: string): string {
  const eventDate = new Date(dateString)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const sameDay = (left: Date, right: Date): boolean =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()

  if (sameDay(eventDate, today)) return "Today"
  if (sameDay(eventDate, yesterday)) return "Yesterday"

  return eventDate.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function getRuleDisplay(ruleName: string): string {
  if (!ruleName) return "Security rule"
  const parts = ruleName.split(".")
  return parts.length > 1 ? parts[0] : ruleName
}

function isWithinTimeRange(timestamp: string, range: TimeRange): boolean {
  if (range === "ALL") return true
  const eventTime = new Date(timestamp).getTime()
  const now = Date.now()
  const ranges: Record<Exclude<TimeRange, "ALL">, number> = {
    "24H": 24 * 60 * 60 * 1000,
    "7D": 7 * 24 * 60 * 60 * 1000,
    "30D": 30 * 24 * 60 * 60 * 1000,
  }
  return now - eventTime <= ranges[range]
}

function groupEvents(events: FleetEvent[]): EventGroup[] {
  const groups = new Map<string, FleetEvent[]>()
  events.forEach((event: FleetEvent) => {
    const label = getDateGroupLabel(event.timestamp)
    const current = groups.get(label) || []
    current.push(event)
    groups.set(label, current)
  })

  return Array.from(groups.entries()).map(([label, groupedEvents]: [string, FleetEvent[]]) => ({
    label,
    events: groupedEvents,
  }))
}

function EventIcon({ type }: { type: EventType }) {
  if (type === "VIOLATION_RESOLVED") {
    return (
      <div className="h-9 w-9 rounded-full bg-status-success/10 border border-status-success/25 text-status-success flex items-center justify-center flex-shrink-0">
        <CheckCircle2 className="h-4.5 w-4.5" />
      </div>
    )
  }

  return (
    <div className="h-9 w-9 rounded-full bg-error/10 border border-error/25 text-error flex items-center justify-center flex-shrink-0">
      <ShieldAlert className="h-4.5 w-4.5" />
    </div>
  )
}

function EventCard({ event }: { event: FleetEvent }) {
  const eventLabel = eventLabels[event.type]
  const policyLabel = event.policy_name
    ? `${event.policy_name}${event.policy_version_number ? ` · v${event.policy_version_number}` : ""}`
    : null

  return (
    <article className="group rounded-xl border border-outline-variant/70 bg-surface-container hover:bg-surface-container-high/45 transition-colors shadow-sm">
      <div className="p-5 md:p-6 flex flex-col gap-4 sm:flex-row sm:items-start">
        <EventIcon type={event.type} />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-on-surface font-sans leading-snug">
                  {eventLabel}
                </h3>
                <StatusBadge status={event.type === "VIOLATION_RESOLVED" ? "RESOLVED" : "FAIL"} />
              </div>
              <p className="text-sm text-on-surface-variant font-sans">
                <Link
                  href={`/devices/${event.device_id}`}
                  className="font-semibold text-on-surface hover:text-tertiary transition-colors"
                >
                  {event.device_hostname}
                </Link>
                <span className="px-2 text-on-surface-variant/50">·</span>
                <span>{getRuleDisplay(event.rule_name)}</span>
              </p>
            </div>

            <time
              dateTime={event.timestamp}
              title={new Date(event.timestamp).toLocaleString()}
              className="text-xs font-medium text-on-surface-variant whitespace-nowrap cursor-help underline decoration-dotted decoration-outline-variant font-sans"
            >
              {getRelativeTime(event.timestamp)}
            </time>
          </div>

          <p className="text-sm leading-relaxed text-on-surface font-sans">
            {event.message}
          </p>

          <div className="flex flex-col gap-3 border-t border-outline-variant/45 pt-3 text-xs text-on-surface-variant md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 min-w-0">
              <span className="font-mono text-[11px] text-on-surface-variant/85 break-all">
                {event.rule_name || "rule unavailable"}
              </span>
              {policyLabel && (
                <span className="font-sans text-on-surface-variant">
                  {policyLabel}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {event.finding_id && (
                <Link
                  href="/findings"
                  className="inline-flex items-center gap-1.5 font-semibold text-tertiary hover:text-white transition-colors"
                  aria-label="Open related finding"
                >
                  <span>Finding</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
              <Link
                href={`/devices/${event.device_id}`}
                className="inline-flex items-center gap-1.5 font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
                aria-label={`Open workstation ${event.device_hostname}`}
              >
                <Laptop className="h-3.5 w-3.5" />
                <span>Workstation</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function ActivityPage() {
  const router = useRouter()
  const [events, setEvents] = useState<FleetEvent[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)
  const [eventTypeFilter, setEventTypeFilter] = useState<"ALL" | EventType>("ALL")
  const [deviceFilter, setDeviceFilter] = useState<string>("ALL")
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL")

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  const fetchDevices = async (): Promise<void> => {
    try {
      const token = localStorage.getItem("flientsec_token")
      if (!token) return
      const res = await fetch(`${apiUrl}/api/v1/devices`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data: Device[] = await res.json()
        setDevices(data.map((device: Device) => ({ id: device.id, hostname: device.hostname })))
      }
    } catch {
      setDevices([])
    }
  }

  const fetchEvents = async (): Promise<void> => {
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
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("flientsec_token")
          router.push("/login")
          return
        }
        throw new Error("Unable to load security activity.")
      }

      const data: { items?: FleetEvent[]; total?: number } = await res.json()
      setEvents(data.items || [])
      setTotal(data.total || 0)
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to load security activity.")
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

  const visibleEvents = useMemo(
    () => events.filter((event: FleetEvent) => isWithinTimeRange(event.timestamp, timeRange)),
    [events, timeRange]
  )

  const groupedEvents = useMemo(() => groupEvents(visibleEvents), [visibleEvents])
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.floor(offset / limit) + 1
  const hasActiveFilters = eventTypeFilter !== "ALL" || deviceFilter !== "ALL" || timeRange !== "ALL"

  const handleClearFilters = (): void => {
    setEventTypeFilter("ALL")
    setDeviceFilter("ALL")
    setTimeRange("ALL")
    setOffset(0)
  }

  const handlePreviousPage = (): void => {
    if (offset > 0) setOffset(Math.max(0, offset - limit))
  }

  const handleNextPage = (): void => {
    if (offset + limit < total) setOffset(offset + limit)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        subtitle="Fleet-wide security events and posture changes."
        actions={
          <button
            onClick={fetchEvents}
            className="p-2 border border-outline-variant hover:bg-surface-container-high rounded-lg text-on-surface-variant hover:text-on-surface transition-colors"
            aria-label="Refresh activity"
            title="Refresh activity"
          >
            <RotateCw className="h-4.5 w-4.5" />
          </button>
        }
      />

      <div className="border-b border-outline-variant/60 flex items-center justify-between pb-px">
        <div className="flex space-x-6 text-sm font-semibold select-none">
          <Link
            href="/activity"
            aria-current="page"
            className="pb-3.5 relative text-tertiary transition-colors"
          >
            All activity
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-tertiary rounded-full" />
          </Link>
          <Link
            href="/findings"
            className="pb-3.5 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Findings
          </Link>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-surface-container-low border border-outline-variant/60 rounded-xl p-4">
        <div className="flex flex-wrap gap-4 w-full sm:w-auto">
          <label className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 font-sans">
              Event type
            </span>
            <select
              value={eventTypeFilter}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setEventTypeFilter(event.target.value as "ALL" | EventType)
              }
              className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-tertiary font-sans"
            >
              <option value="ALL">All activity</option>
              <option value="VIOLATION_TRIGGERED">Violation triggered</option>
              <option value="VIOLATION_RESOLVED">Violation resolved</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 font-sans">
              Workstation
            </span>
            <select
              value={deviceFilter}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setDeviceFilter(event.target.value)}
              className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-tertiary max-w-[220px] font-sans"
            >
              <option value="ALL">All workstations</option>
              {devices.map((device: Device) => (
                <option key={device.id} value={device.id}>
                  {device.hostname}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70 font-sans">
              Time range
            </span>
            <select
              value={timeRange}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) => setTimeRange(event.target.value as TimeRange)}
              className="px-3 py-2 bg-surface-container border border-outline-variant rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-tertiary font-sans"
            >
              <option value="ALL">All time</option>
              <option value="24H">Last 24 hours</option>
              <option value="7D">Last 7 days</option>
              <option value="30D">Last 30 days</option>
            </select>
          </label>
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center space-x-2 text-xs font-semibold text-tertiary hover:text-white transition-colors py-2 px-3 border border-outline-variant rounded-lg bg-surface-container hover:bg-surface-container-high"
          >
            <FilterX className="h-3.5 w-3.5" />
            <span>Clear filters</span>
          </button>
        )}
      </div>

      {loading ? (
        <Panel className="p-12">
          <LoadingState message="Loading security activity..." />
        </Panel>
      ) : error ? (
        <Panel className="p-12 text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-error mx-auto" />
          <h3 className="text-base font-semibold text-on-surface font-sans">
            Unable to load security activity.
          </h3>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto leading-relaxed font-sans">
            {error}
          </p>
          <button
            onClick={fetchEvents}
            className="px-4 py-2 text-xs font-semibold text-white bg-tertiary hover:bg-tertiary-hover rounded-lg transition-colors inline-flex items-center space-x-2"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </Panel>
      ) : visibleEvents.length === 0 ? (
        <Panel className="p-16">
          {hasActiveFilters ? (
            <div className="space-y-5">
              <EmptyState
                title="No activity matches these filters"
                description="Clear the active filters to return to the full fleet activity timeline."
                icon={FilterX}
              />
              <div className="flex justify-center">
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No security activity yet"
              description="Security events will appear here when workstation posture changes are detected."
              icon={ShieldAlert}
            />
          )}
        </Panel>
      ) : (
        <div className="space-y-4">
          <Panel className="p-5 md:p-6">
            <SectionHeader title="Security Activity" icon={ShieldAlert} />
            <div className="pt-6 space-y-8">
              {groupedEvents.map((group: EventGroup) => (
                <section key={group.label} className="space-y-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant/70 font-sans">
                    {group.label}
                  </h2>
                  <div className="space-y-3">
                    {group.events.map((event: FleetEvent) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </Panel>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-outline-variant/65 rounded-xl bg-surface-container-low p-4 text-sm">
            <span className="text-xs text-on-surface-variant font-medium font-sans">
              Showing{" "}
              <span className="font-semibold text-on-surface">
                {total === 0 ? 0 : offset + 1}
              </span>
              {"-"}
              <span className="font-semibold text-on-surface">
                {Math.min(total, offset + limit)}
              </span>{" "}
              of <span className="font-semibold text-on-surface">{total}</span> events
              {timeRange !== "ALL" && (
                <span className="text-on-surface-variant/70">
                  {" "}
                  ({visibleEvents.length} visible after time filter)
                </span>
              )}
              {" "} · Page {currentPage} of {totalPages}
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
        </div>
      )}
    </div>
  )
}
